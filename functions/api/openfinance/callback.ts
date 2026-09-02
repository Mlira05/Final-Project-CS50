// CS50 Final Project — functions/api/openfinance/callback.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { encryptSecret } from "../../_shared/crypto";
import { apiError } from "../../_shared/http";
import { sanitizeOpenFinanceConnection } from "../../_shared/openfinance/connections";
import type { Env, OpenFinanceConnectionRow, PublicProfileRow } from "../../_shared/types";

const publicColumns = `id, profile_id, provider, holder_name, document_last4, document_hash,
  access_token_encrypted, refresh_token_encrypted, client_id_encrypted, token_url, mcp_url,
  token_expires_at, consent_status, status, last_success_at, last_error, created_at, updated_at`;

function appBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return apiError("Metodo nao permitido.", 405);
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return apiError("Callback Cumbuca sem code ou state.", 400);
    }

    const schema = await getDbFeatureFlags(env.DB);
    if (!schema.hasCumbucaConsentStates || !schema.hasOpenFinanceConnections) {
      return apiError("Aplique a migration de consentimento Open Finance antes de concluir o callback.", 409);
    }

    const pending = await env.DB
      .prepare("SELECT * FROM cumbuca_consent_states WHERE state = ? AND status = 'pending'")
      .bind(state)
      .first<{ profile_id: number }>();
    if (!pending) {
      return apiError("State Cumbuca invalido ou ja utilizado.", 400);
    }

    const tokenUrl = env.CUMBUCA_MCP_TOKEN_URL;
    const clientId = env.CUMBUCA_MCP_CLIENT_ID;
    const redirectUri = env.CUMBUCA_REDIRECT_URI ?? `${appBaseUrl(request)}/api/openfinance/callback`;
    if (!tokenUrl || !clientId) {
      return apiError("Configure CUMBUCA_MCP_TOKEN_URL e CUMBUCA_MCP_CLIENT_ID para trocar o code por tokens.", 500);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      return apiError("Cumbuca nao aceitou a troca do codigo de autorizacao.", 400);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const profile = await env.DB
      .prepare("SELECT id, name, created_at, updated_at FROM profiles WHERE id = ?")
      .bind(pending.profile_id)
      .first<PublicProfileRow>();

    const existing = await env.DB
      .prepare("SELECT id FROM open_finance_connections WHERE profile_id = ? AND provider = 'cumbuca' AND status = 'active' LIMIT 1")
      .bind(pending.profile_id)
      .first<{ id: number }>();

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    const accessToken = tokens.access_token ? await encryptSecret(env, tokens.access_token) : null;
    const refreshToken = tokens.refresh_token ? await encryptSecret(env, tokens.refresh_token) : null;
    const clientIdEncrypted = await encryptSecret(env, clientId);

    const connection = existing
      ? await env.DB
          .prepare(
            `UPDATE open_finance_connections
             SET holder_name = COALESCE(holder_name, ?),
                 access_token_encrypted = COALESCE(?, access_token_encrypted),
                 refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
                 client_id_encrypted = ?,
                 token_url = ?,
                 token_expires_at = ?,
                 consent_status = 'active',
                 status = 'active',
                 last_error = NULL
             WHERE id = ?
             RETURNING ${publicColumns}`,
          )
          .bind(profile?.name ?? "Perfil", accessToken, refreshToken, clientIdEncrypted, tokenUrl, expiresAt, existing.id)
          .first<OpenFinanceConnectionRow>()
      : await env.DB
          .prepare(
            `INSERT INTO open_finance_connections
              (profile_id, provider, holder_name, access_token_encrypted, refresh_token_encrypted,
               client_id_encrypted, token_url, token_expires_at, consent_status, status)
             VALUES (?, 'cumbuca', ?, ?, ?, ?, ?, ?, 'active', 'active')
             RETURNING ${publicColumns}`,
          )
          .bind(pending.profile_id, profile?.name ?? "Perfil", accessToken, refreshToken, clientIdEncrypted, tokenUrl, expiresAt)
          .first<OpenFinanceConnectionRow>();

    await env.DB
      .prepare("UPDATE cumbuca_consent_states SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP WHERE state = ?")
      .bind(state)
      .run();

    sanitizeOpenFinanceConnection(connection!);
    return Response.redirect(`${appBaseUrl(request)}/?settings=openFinance`, 302);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Nao foi possivel concluir o callback Cumbuca.", 400);
  }
};
