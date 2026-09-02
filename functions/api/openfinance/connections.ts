// CS50 Final Project — functions/api/openfinance/connections.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAppAccess, requireExistingProfile } from "../../_shared/auth";
import { encryptSecret, hashPrivateValue } from "../../_shared/crypto";
import { apiError, json, methodNotAllowed, optionalText, parseId, readJson } from "../../_shared/http";
import {
  getOpenFinanceConnectionById,
  isMissingOpenFinanceTableError,
  listOpenFinanceConnections,
  missingOpenFinanceSchemaMessage,
  sanitizeOpenFinanceConnection,
} from "../../_shared/openfinance/connections";
import type { Env, OpenFinanceConnectionRow } from "../../_shared/types";

interface ConnectionBody {
  id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  provider?: unknown;
  holderName?: unknown;
  holder_name?: unknown;
  document?: unknown;
  accessToken?: unknown;
  access_token?: unknown;
  refreshToken?: unknown;
  refresh_token?: unknown;
  clientId?: unknown;
  client_id?: unknown;
  tokenUrl?: unknown;
  token_url?: unknown;
  mcpUrl?: unknown;
  mcp_url?: unknown;
  tokenExpiresAt?: unknown;
  token_expires_at?: unknown;
  consentStatus?: unknown;
  consent_status?: unknown;
  status?: unknown;
}

const publicColumns = `id, profile_id, provider, holder_name, document_last4, document_hash,
  access_token_encrypted, refresh_token_encrypted, client_id_encrypted, token_url, mcp_url,
  token_expires_at, consent_status, status, last_success_at, last_error, created_at, updated_at`;

function providerOf(value: unknown) {
  const provider = optionalText(value) ?? "cumbuca";
  if (provider !== "cumbuca") {
    throw new Error("Provider Open Finance inválido.");
  }

  return provider;
}

function bodyText(body: ConnectionBody, camel: keyof ConnectionBody, snake: keyof ConnectionBody) {
  const raw = body[camel] ?? body[snake];
  return optionalText(raw);
}

async function documentFields(env: Env, document: unknown) {
  const digits = String(document ?? "").replace(/\D/g, "");
  if (!digits) {
    return { documentLast4: null, documentHash: null };
  }

  return {
    documentLast4: digits.slice(-4),
    documentHash: await hashPrivateValue(env, digits),
  };
}

async function encryptedValue(env: Env, value: unknown) {
  const text = optionalText(value);
  return text ? encryptSecret(env, text) : null;
}

async function findActiveConnection(db: D1Database, profileId: number, provider: string) {
  return db
    .prepare("SELECT * FROM open_finance_connections WHERE profile_id = ? AND provider = ? AND status = 'active' LIMIT 1")
    .bind(profileId, provider)
    .first<OpenFinanceConnectionRow>();
}

async function readSanitizedConnection(db: D1Database, id: number) {
  const connection = await getOpenFinanceConnectionById(db, id);
  if (!connection) {
    throw new Error("Conexão Open Finance não encontrada.");
  }

  return sanitizeOpenFinanceConnection(connection);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAppAccess(request, env);
  if (auth) {
    return auth;
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const profileId = url.searchParams.get("profileId") ? parseId(url.searchParams.get("profileId"), "profileId") : undefined;
      if (profileId) {
        const profileAuth = await requireExistingProfile(request, env, profileId);
        if (profileAuth) {
          return profileAuth;
        }
      }

      const connections = await listOpenFinanceConnections(env.DB, profileId);
      return json({ connections: connections.map(sanitizeOpenFinanceConnection) });
    }

    if (request.method === "POST") {
      const body = await readJson<ConnectionBody>(request);
      const profileId = parseId(body.profileId ?? body.profile_id, "profileId");
      const profileAuth = await requireExistingProfile(request, env, profileId);
      if (profileAuth) {
        return profileAuth;
      }

      const provider = providerOf(body.provider);
      const existing = await findActiveConnection(env.DB, profileId, provider);
      const holderName = bodyText(body, "holderName", "holder_name");
      const tokenUrl = bodyText(body, "tokenUrl", "token_url");
      const mcpUrl = bodyText(body, "mcpUrl", "mcp_url");
      const tokenExpiresAt = bodyText(body, "tokenExpiresAt", "token_expires_at");
      const consentStatus = bodyText(body, "consentStatus", "consent_status") ?? "unknown";
      const { documentLast4, documentHash } = await documentFields(env, body.document);
      const accessToken = await encryptedValue(env, body.accessToken ?? body.access_token);
      const refreshToken = await encryptedValue(env, body.refreshToken ?? body.refresh_token);
      const clientId = await encryptedValue(env, body.clientId ?? body.client_id);

      if (existing) {
        const connection = await env.DB.prepare(
          `UPDATE open_finance_connections
           SET holder_name = COALESCE(?, holder_name),
               document_last4 = COALESCE(?, document_last4),
               document_hash = COALESCE(?, document_hash),
               access_token_encrypted = COALESCE(?, access_token_encrypted),
               refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
               client_id_encrypted = COALESCE(?, client_id_encrypted),
               token_url = ?, mcp_url = ?, token_expires_at = ?, consent_status = ?, status = 'active'
           WHERE id = ?
           RETURNING ${publicColumns}`,
        )
          .bind(holderName, documentLast4, documentHash, accessToken, refreshToken, clientId, tokenUrl, mcpUrl, tokenExpiresAt, consentStatus, existing.id)
          .first<OpenFinanceConnectionRow>();

        return json({ connection: sanitizeOpenFinanceConnection(connection!) });
      }

      const connection = await env.DB.prepare(
        `INSERT INTO open_finance_connections
          (profile_id, provider, holder_name, document_last4, document_hash, access_token_encrypted,
           refresh_token_encrypted, client_id_encrypted, token_url, mcp_url, token_expires_at, consent_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
         RETURNING ${publicColumns}`,
      )
        .bind(profileId, provider, holderName, documentLast4, documentHash, accessToken, refreshToken, clientId, tokenUrl, mcpUrl, tokenExpiresAt, consentStatus)
        .first<OpenFinanceConnectionRow>();

      return json({ connection: sanitizeOpenFinanceConnection(connection!) }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<ConnectionBody>(request);
      const id = parseId(body.id);
      const existing = await getOpenFinanceConnectionById(env.DB, id);
      if (!existing) {
        return apiError("Conexão Open Finance não encontrada.", 404);
      }

      const profileAuth = await requireExistingProfile(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const updates: string[] = [];
      const values: Array<string | number | null> = [];
      const assign = (column: string, value: string | null) => {
        updates.push(`${column} = ?`);
        values.push(value);
      };

      if ("holderName" in body || "holder_name" in body) {
        assign("holder_name", bodyText(body, "holderName", "holder_name"));
      }
      if ("document" in body) {
        const { documentLast4, documentHash } = await documentFields(env, body.document);
        assign("document_last4", documentLast4);
        assign("document_hash", documentHash);
      }
      if ("accessToken" in body || "access_token" in body) {
        assign("access_token_encrypted", await encryptedValue(env, body.accessToken ?? body.access_token));
      }
      if ("refreshToken" in body || "refresh_token" in body) {
        assign("refresh_token_encrypted", await encryptedValue(env, body.refreshToken ?? body.refresh_token));
      }
      if ("clientId" in body || "client_id" in body) {
        assign("client_id_encrypted", await encryptedValue(env, body.clientId ?? body.client_id));
      }
      if ("tokenUrl" in body || "token_url" in body) {
        assign("token_url", bodyText(body, "tokenUrl", "token_url"));
      }
      if ("mcpUrl" in body || "mcp_url" in body) {
        assign("mcp_url", bodyText(body, "mcpUrl", "mcp_url"));
      }
      if ("tokenExpiresAt" in body || "token_expires_at" in body) {
        assign("token_expires_at", bodyText(body, "tokenExpiresAt", "token_expires_at"));
      }
      if ("consentStatus" in body || "consent_status" in body) {
        assign("consent_status", bodyText(body, "consentStatus", "consent_status") ?? "unknown");
      }
      if ("status" in body) {
        const status = bodyText(body, "status", "status") ?? "active";
        if (!["active", "revoked", "error"].includes(status)) {
          return apiError("Status de conexão inválido.", 400);
        }
        assign("status", status);
      }

      if (updates.length === 0) {
        return json({ connection: await readSanitizedConnection(env.DB, id) });
      }

      const connection = await env.DB.prepare(
        `UPDATE open_finance_connections
         SET ${updates.join(", ")}
         WHERE id = ?
         RETURNING ${publicColumns}`,
      )
        .bind(...values, id)
        .first<OpenFinanceConnectionRow>();

      return json({ connection: sanitizeOpenFinanceConnection(connection!) });
    }

    if (request.method === "DELETE") {
      const body = await readJson<ConnectionBody>(request);
      const id = parseId(body.id);
      const existing = await getOpenFinanceConnectionById(env.DB, id);
      if (!existing) {
        return apiError("Conexão Open Finance não encontrada.", 404);
      }

      const profileAuth = await requireExistingProfile(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const connection = await env.DB.prepare(
        `UPDATE open_finance_connections
         SET status = 'revoked'
         WHERE id = ?
         RETURNING ${publicColumns}`,
      )
        .bind(id)
        .first<OpenFinanceConnectionRow>();

      return json({ ok: true, connection: sanitizeOpenFinanceConnection(connection!) });
    }

    return methodNotAllowed();
  } catch (error) {
    if (isMissingOpenFinanceTableError(error)) {
      return apiError(missingOpenFinanceSchemaMessage(), 400);
    }

    return apiError(error instanceof Error ? error.message : "Falha ao gerenciar conexão Open Finance.", 400);
  }
};
