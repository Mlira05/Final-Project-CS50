// CS50 Final Project — functions/api/openfinance/sync.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../../_shared/auth";
import { apiError, json, methodNotAllowed, parseId, readJson } from "../../_shared/http";
import { isMissingOpenFinanceTableError, missingOpenFinanceSchemaMessage } from "../../_shared/openfinance/connections";
import { syncOpenFinanceTransactions } from "../../_shared/openfinance/sync.ts";
import type { Env } from "../../_shared/types";

interface SyncBody {
  profileId?: unknown;
  profile_id?: unknown;
  fullImport?: unknown;
  connectionId?: unknown;
  connection_id?: unknown;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJson<SyncBody>(request);
    const profileId = parseId(body.profileId ?? body.profile_id, "profileId");
    const auth = await requireProfileAccess(request, env, profileId);
    if (auth) {
      return auth;
    }

    const result = await syncOpenFinanceTransactions(env, profileId, {
      fullImport: body.fullImport === true,
      connectionId:
        body.connectionId || body.connection_id
          ? parseId(body.connectionId ?? body.connection_id, "connectionId")
          : undefined,
    });

    return json(result);
  } catch (error) {
    if (isMissingOpenFinanceTableError(error)) {
      return apiError(missingOpenFinanceSchemaMessage(), 400);
    }

    return apiError(error instanceof Error ? error.message : "Nao foi possivel atualizar os dados.", 400);
  }
};
