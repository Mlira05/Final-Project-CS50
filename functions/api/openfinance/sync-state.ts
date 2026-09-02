// CS50 Final Project — functions/api/openfinance/sync-state.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { apiError, json, methodNotAllowed, parseId } from "../../_shared/http";
import { friendlyMcpError } from "../../_shared/openfinance/cumbucaMcpClient.ts";
import {
  getActiveOpenFinanceConnection,
  hasLegacyGlobalCumbucaCredentials,
  isMissingOpenFinanceTableError,
  listOpenFinanceConnections,
  missingOpenFinanceSchemaMessage,
  sanitizeOpenFinanceConnection,
} from "../../_shared/openfinance/connections";
import type { Env, OpenFinanceSyncJobRow, OpenFinanceSyncStateRow } from "../../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  try {
    const url = new URL(request.url);
    const profileId = parseId(url.searchParams.get("profileId"), "profileId");
    const auth = await requireProfileAccess(request, env, profileId);
    if (auth) {
      return auth;
    }

    const schema = await getDbFeatureFlags(env.DB);
    const hasBaseOpenFinanceSchema =
      schema.hasOpenFinanceTransactions && schema.hasOpenFinanceSyncState && schema.hasOpenFinanceSyncJobs;

    if (!hasBaseOpenFinanceSchema) {
      return json({
        connected: false,
        usingLegacyGlobalConnection: false,
        activeConnection: null,
        connections: [],
        connectionDisplayStatus: "error",
        lastSuccessAt: null,
        lastError: missingOpenFinanceSchemaMessage(),
        status: "unavailable",
        state: null,
        jobs: [],
      });
    }

    const state = await env.DB.prepare(
      "SELECT * FROM open_finance_sync_state WHERE owner_id = ? AND provider = 'cumbuca'",
    )
      .bind(profileId)
      .first<OpenFinanceSyncStateRow>();

    const { results: jobs = [] } = await env.DB.prepare(
      `SELECT * FROM open_finance_sync_jobs
       WHERE owner_id = ? AND provider = 'cumbuca'
       ORDER BY started_at DESC
       LIMIT 5`,
    )
      .bind(profileId)
      .all<OpenFinanceSyncJobRow>();

    const [activeConnection, connections] = schema.hasOpenFinanceConnections
      ? await Promise.all([
          getActiveOpenFinanceConnection(env.DB, profileId, "cumbuca"),
          listOpenFinanceConnections(env.DB, profileId),
        ])
      : [null, []];
    const usingLegacyGlobalConnection = !activeConnection && hasLegacyGlobalCumbucaCredentials(env);
    const connectionLastError = activeConnection?.last_error ? friendlyMcpError(activeConnection.last_error) : null;
    const lastError = state?.last_error ? friendlyMcpError(state.last_error) : connectionLastError;
    const connectionDisplayStatus = lastError
      ? "error"
      : activeConnection
        ? "profile_connected"
        : usingLegacyGlobalConnection
          ? "legacy_connected"
          : "disconnected";

    return json({
      connected: Boolean(activeConnection || usingLegacyGlobalConnection),
      usingLegacyGlobalConnection,
      activeConnection: activeConnection ? sanitizeOpenFinanceConnection(activeConnection) : null,
      connections: connections.map(sanitizeOpenFinanceConnection),
      connectionDisplayStatus,
      lastSuccessAt: state?.last_success_at ?? null,
      lastError,
      status: state?.status ?? "idle",
      state: state ? { ...state, last_error: lastError } : null,
      jobs,
    });
  } catch (error) {
    if (isMissingOpenFinanceTableError(error)) {
      return json({
        connected: false,
        usingLegacyGlobalConnection: false,
        activeConnection: null,
        connections: [],
        connectionDisplayStatus: "error",
        lastSuccessAt: null,
        lastError: missingOpenFinanceSchemaMessage(),
        status: "unavailable",
        state: null,
        jobs: [],
      });
    }

    return apiError(error instanceof Error ? error.message : "Nao foi possivel carregar o estado da atualizacao.", 400);
  }
};
