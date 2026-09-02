// CS50 Final Project — functions/api/auth/profiles.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { apiError, json } from "../../_shared/http";
import { listLoginProfiles } from "../../_shared/auth";
import type { Env } from "../../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return apiError("Método não permitido.", 405);
  }

  try {
    return json({ profiles: await listLoginProfiles(env) });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível carregar os perfis.", 400);
  }
};

