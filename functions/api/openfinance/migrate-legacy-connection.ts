// CS50 Final Project — functions/api/openfinance/migrate-legacy-connection.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireExistingProfile } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { encryptSecret } from "../../_shared/crypto";
import { apiError, json, methodNotAllowed, parseId, readJson } from "../../_shared/http";
import {
  getActiveOpenFinanceConnection,
  hasLegacyGlobalCumbucaCredentials,
  sanitizeOpenFinanceConnection,
} from "../../_shared/openfinance/connections";
import type { Env, OpenFinanceConnectionRow, PublicProfileRow } from "../../_shared/types";

interface MigrateLegacyBody {
  profileId?: unknown;
  profile_id?: unknown;
}

const publicColumns = `id, profile_id, provider, holder_name, document_last4, document_hash,
  access_token_encrypted, refresh_token_encrypted, client_id_encrypted, token_url, mcp_url,
  token_expires_at, consent_status, status, last_success_at, last_error, created_at, updated_at`;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJson<MigrateLegacyBody>(request);
    const profileId = parseId(body.profileId ?? body.profile_id, "profileId");
    const auth = await requireExistingProfile(request, env, profileId);
    if (auth) {
      return auth;
    }

    const schema = await getDbFeatureFlags(env.DB);
    if (!schema.hasOpenFinanceConnections) {
      return apiError("Aplique a migration de conexoes Open Finance antes de migrar a conexao legada.", 409);
    }

    const existing = await getActiveOpenFinanceConnection(env.DB, profileId, "cumbuca");
    if (existing) {
      return json({ connection: sanitizeOpenFinanceConnection(existing), migrated: false });
    }

    if (!hasLegacyGlobalCumbucaCredentials(env)) {
      return apiError("Nao ha secrets globais legados Cumbuca configurados para migrar.", 400);
    }

    const profile = await env.DB
      .prepare("SELECT id, name, created_at, updated_at FROM profiles WHERE id = ?")
      .bind(profileId)
      .first<PublicProfileRow>();

    const connection = await env.DB.prepare(
      `INSERT INTO open_finance_connections
        (profile_id, provider, holder_name, access_token_encrypted, refresh_token_encrypted,
         client_id_encrypted, token_url, consent_status, status)
       VALUES (?, 'cumbuca', ?, ?, ?, ?, ?, 'active', 'active')
       RETURNING ${publicColumns}`,
    )
      .bind(
        profileId,
        profile?.name ?? "Perfil",
        env.CUMBUCA_MCP_ACCESS_TOKEN ? await encryptSecret(env, env.CUMBUCA_MCP_ACCESS_TOKEN) : null,
        env.CUMBUCA_MCP_REFRESH_TOKEN ? await encryptSecret(env, env.CUMBUCA_MCP_REFRESH_TOKEN) : null,
        env.CUMBUCA_MCP_CLIENT_ID ? await encryptSecret(env, env.CUMBUCA_MCP_CLIENT_ID) : null,
        env.CUMBUCA_MCP_TOKEN_URL ?? null,
      )
      .first<OpenFinanceConnectionRow>();

    return json({ connection: sanitizeOpenFinanceConnection(connection!), migrated: true }, 201);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Nao foi possivel migrar a conexao Open Finance legada.", 400);
  }
};
