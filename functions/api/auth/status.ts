// CS50 Final Project — functions/api/auth/status.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { handleAuthStatus } from "../../_shared/auth";
import type { Env } from "../../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return handleAuthStatus(request, env);
};

