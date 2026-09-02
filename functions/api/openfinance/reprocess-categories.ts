// CS50 Final Project — functions/api/openfinance/reprocess-categories.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { apiError, json, methodNotAllowed, parseId, readJson } from "../../_shared/http";
import { reprocessTransactionCategories } from "../../_shared/openfinance/categorization";
import type { Env } from "../../_shared/types";

interface ReprocessBody {
  profileId?: unknown;
  profile_id?: unknown;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth) {
    return auth;
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const body = await readJson<ReprocessBody>(request);
    const profileId = parseId(body.profileId ?? body.profile_id, "profileId");
    const profileAuth = await requireProfileAccess(request, env, profileId);
    if (profileAuth) {
      return profileAuth;
    }

    const schema = await getDbFeatureFlags(env.DB);
    if (!schema.hasSystemCategory) {
      return json({
        ok: true,
        processed: 0,
        updated: 0,
      });
    }

    const result = await reprocessTransactionCategories(env.DB, profileId);
    return json({
      ok: true,
      processed: result.processed,
      updated: result.updated,
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível reprocessar as categorias.", 400);
  }
};
