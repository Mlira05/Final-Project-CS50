// CS50 Final Project — functions/api/profiles.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../_shared/auth";
import { apiError, json, methodNotAllowed, optionalText, parseId, readJson, requiredText } from "../_shared/http";
import type { Env, ProfileRow, PublicProfileRow } from "../_shared/types";

interface ProfileBody {
  id?: unknown;
  name?: unknown;
}

async function getProfile(db: D1Database, id: number) {
  return db.prepare("SELECT * FROM profiles WHERE id = ?").bind(id).first<ProfileRow>();
}

const publicProfileColumns = "id, name, created_at, updated_at";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth) {
    return auth;
  }

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(`SELECT ${publicProfileColumns} FROM profiles ORDER BY id ASC`).all<PublicProfileRow>();
      return json({ profiles: results ?? [] });
    }

    if (request.method === "POST") {
      const body = await readJson<ProfileBody>(request);
      const name = requiredText(body.name, "Nome do perfil");
      const profile = await env.DB.prepare(
        `INSERT INTO profiles (name) VALUES (?) RETURNING ${publicProfileColumns}`,
      )
        .bind(name)
        .first<PublicProfileRow>();

      return json({ profile }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<ProfileBody>(request);
      const id = parseId(body.id);
      const profileAuth = await requireProfileAccess(request, env, id);
      if (profileAuth) {
        return profileAuth;
      }

      const name = requiredText(body.name, "Nome do perfil");
      const profile = await env.DB.prepare(
        `UPDATE profiles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING ${publicProfileColumns}`,
      )
        .bind(name, id)
        .first<PublicProfileRow>();

      if (!profile) {
        return apiError("Perfil não encontrado.", 404);
      }

      return json({ profile });
    }

    if (request.method === "DELETE") {
      const body = await readJson<ProfileBody>(request);
      const id = parseId(body.id);
      const profileAuth = await requireProfileAccess(request, env, id);
      if (profileAuth) {
        return profileAuth;
      }

      const profile = await getProfile(env.DB, id);
      if (!profile) {
        return apiError("Perfil não encontrado.", 404);
      }

      const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM profiles").first<{ total: number }>();
      if ((count?.total ?? 0) <= 1) {
        return apiError("Mantenha pelo menos um perfil.", 400);
      }

      await env.DB.prepare("DELETE FROM profiles WHERE id = ?").bind(id).run();
      return json({ ok: true, deletedProfile: optionalText(profile.name) });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de perfis.", 400);
  }
};
