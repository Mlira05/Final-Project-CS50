// CS50 Final Project — functions/api/auth/logout.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { handleLogout } from "../../_shared/auth";
import { methodNotAllowed } from "../../_shared/http";
import type { Env } from "../../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  return handleLogout(request);
};

