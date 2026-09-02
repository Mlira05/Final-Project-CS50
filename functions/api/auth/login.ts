// CS50 Final Project — functions/api/auth/login.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { handleLogin } from "../../_shared/auth";
import { apiError } from "../../_shared/http";
import type { Env } from "../../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    return await handleLogin(request, env);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível entrar.", 400);
  }
};
