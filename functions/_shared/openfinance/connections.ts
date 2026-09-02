// CS50 Final Project — functions/_shared/openfinance/connections.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { decryptSecret, encryptSecret } from "../crypto";
import type { Env, OpenFinanceConnectionRow, PublicOpenFinanceConnection } from "../types";

export interface CumbucaCredentials {
  accessToken?: string | null;
  refreshToken?: string | null;
  clientId?: string | null;
  tokenUrl?: string | null;
  mcpUrl?: string | null;
  onTokensRefreshed?: (tokens: { accessToken?: string | null; refreshToken?: string | null; expiresIn?: number | null }) => Promise<void>;
}

export function isMissingOpenFinanceTableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /no such table:\s*open_finance_/i.test(error.message);
}

export function missingOpenFinanceSchemaMessage() {
  return "Open Finance ainda nao esta pronto neste ambiente. Aplique as migrations mais recentes e configure a conexao do perfil.";
}

export function hasLegacyGlobalCumbucaCredentials(env: Env) {
  return Boolean(env.CUMBUCA_MCP_ACCESS_TOKEN || (env.CUMBUCA_MCP_REFRESH_TOKEN && env.CUMBUCA_MCP_CLIENT_ID));
}

export function sanitizeOpenFinanceConnection(connection: OpenFinanceConnectionRow): PublicOpenFinanceConnection {
  return {
    id: connection.id,
    profile_id: connection.profile_id,
    provider: connection.provider,
    holder_name: connection.holder_name,
    document_last4: connection.document_last4,
    document_hash: connection.document_hash,
    token_url: connection.token_url,
    mcp_url: connection.mcp_url,
    token_expires_at: connection.token_expires_at,
    consent_status: connection.consent_status,
    status: connection.status,
    last_success_at: connection.last_success_at,
    last_error: connection.last_error,
    created_at: connection.created_at,
    updated_at: connection.updated_at,
    has_access_token: Boolean(connection.access_token_encrypted),
    has_refresh_token: Boolean(connection.refresh_token_encrypted),
    has_client_id: Boolean(connection.client_id_encrypted),
  };
}

export async function getActiveOpenFinanceConnection(db: D1Database, profileId: number, provider = "cumbuca") {
  return db
    .prepare(
      `SELECT * FROM open_finance_connections
       WHERE profile_id = ? AND provider = ? AND status = 'active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(profileId, provider)
    .first<OpenFinanceConnectionRow>();
}

export async function getOpenFinanceConnectionById(db: D1Database, connectionId: number) {
  return db.prepare("SELECT * FROM open_finance_connections WHERE id = ?").bind(connectionId).first<OpenFinanceConnectionRow>();
}

export async function listOpenFinanceConnections(db: D1Database, profileId?: number) {
  const statement = profileId
    ? db.prepare("SELECT * FROM open_finance_connections WHERE profile_id = ? ORDER BY profile_id ASC, updated_at DESC").bind(profileId)
    : db.prepare("SELECT * FROM open_finance_connections ORDER BY profile_id ASC, updated_at DESC");
  const { results = [] } = await statement.all<OpenFinanceConnectionRow>();
  return results;
}

export async function loadDecryptedCumbucaCredentials(env: Env, connection: OpenFinanceConnectionRow): Promise<CumbucaCredentials> {
  return {
    accessToken: await decryptSecret(env, connection.access_token_encrypted),
    refreshToken: await decryptSecret(env, connection.refresh_token_encrypted),
    clientId: await decryptSecret(env, connection.client_id_encrypted),
    tokenUrl: connection.token_url,
    mcpUrl: connection.mcp_url,
    onTokensRefreshed: async (tokens) => updateConnectionTokens(env, connection.id, tokens),
  };
}

export async function updateConnectionTokens(
  env: Env,
  connectionId: number,
  tokens: { accessToken?: string | null; refreshToken?: string | null; expiresIn?: number | null },
) {
  const updates: string[] = [];
  const values: Array<string | null | number> = [];

  if (tokens.accessToken) {
    updates.push("access_token_encrypted = ?");
    values.push(await encryptSecret(env, tokens.accessToken));
  }

  if (tokens.refreshToken) {
    updates.push("refresh_token_encrypted = ?");
    values.push(await encryptSecret(env, tokens.refreshToken));
  }

  if (tokens.expiresIn) {
    updates.push("token_expires_at = ?");
    values.push(new Date(Date.now() + tokens.expiresIn * 1000).toISOString());
  }

  if (updates.length === 0) {
    return;
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  await env.DB.prepare(`UPDATE open_finance_connections SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values, connectionId)
    .run();
}
