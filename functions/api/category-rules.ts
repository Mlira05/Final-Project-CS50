// CS50 Final Project — functions/api/category-rules.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../_shared/auth";
import { getDbFeatureFlags } from "../_shared/db-schema";
import {
  apiError,
  boolToInt,
  json,
  methodNotAllowed,
  parseEnum,
  parseId,
  parseInteger,
  readJson,
  requiredText,
} from "../_shared/http";
import type { CategoryRuleRow, CategoryRow, Env } from "../_shared/types";

interface CategoryRuleBody {
  id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  matchType?: unknown;
  match_type?: unknown;
  pattern?: unknown;
  category?: unknown;
  priority?: unknown;
  isActive?: unknown;
  is_active?: unknown;
}

const matchTypes = ["merchant", "description", "original_category", "contains"] as const;

async function ensureCategoryAvailable(db: D1Database, profileId: number, categoryName: string) {
  const { results = [] } = await db
    .prepare("SELECT * FROM categories WHERE profile_id IS NULL OR profile_id = ?")
    .bind(profileId)
    .all<CategoryRow>();

  return results.some((category) => category.name === categoryName);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth) {
    return auth;
  }

  try {
    const schema = await getDbFeatureFlags(env.DB);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const profileId = parseId(url.searchParams.get("profileId"), "profileId");
      const profileAuth = await requireProfileAccess(request, env, profileId);
      if (profileAuth) {
        return profileAuth;
      }

      if (!schema.hasCategoryRules) {
        return json({ rules: [] });
      }

      const { results = [] } = await env.DB
        .prepare(
          `SELECT *
           FROM category_rules
           WHERE profile_id = ?
           ORDER BY priority ASC, created_at DESC, id DESC`,
        )
        .bind(profileId)
        .all<CategoryRuleRow>();

      return json({ rules: results });
    }

    if (request.method === "POST") {
      if (!schema.hasCategoryRules) {
        return apiError("As regras automáticas ainda não estão disponíveis nesta base. Aplique a migration 0004.", 409);
      }

      const body = await readJson<CategoryRuleBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const profileAuth = await requireProfileAccess(request, env, profileId);
      if (profileAuth) {
        return profileAuth;
      }

      const matchType = parseEnum(body.match_type ?? body.matchType, "Tipo de correspondência", matchTypes);
      const pattern = requiredText(body.pattern, "Padrão");
      const category = requiredText(body.category, "Categoria");
      const priority = parseInteger(body.priority ?? 100, "Prioridade", { min: 0, max: 10000 });
      const isActive = boolToInt(body.is_active ?? body.isActive ?? true);

      if (!(await ensureCategoryAvailable(env.DB, profileId, category))) {
        return apiError("A categoria de destino precisa existir para este perfil.", 404);
      }

      const rule = await env.DB
        .prepare(
          `INSERT INTO category_rules (profile_id, match_type, pattern, category, priority, is_active)
           VALUES (?, ?, ?, ?, ?, ?)
           RETURNING *`,
        )
        .bind(profileId, matchType, pattern, category, priority, isActive)
        .first<CategoryRuleRow>();

      return json({ rule }, 201);
    }

    if (request.method === "PUT") {
      if (!schema.hasCategoryRules) {
        return apiError("As regras automáticas ainda não estão disponíveis nesta base. Aplique a migration 0004.", 409);
      }

      const body = await readJson<CategoryRuleBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM category_rules WHERE id = ?").bind(id).first<CategoryRuleRow>();
      if (!existing) {
        return apiError("Regra não encontrada.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const matchType = parseEnum(
        body.match_type ?? body.matchType ?? existing.match_type,
        "Tipo de correspondência",
        matchTypes,
      );
      const pattern = requiredText(body.pattern ?? existing.pattern, "Padrão");
      const category = requiredText(body.category ?? existing.category, "Categoria");
      const priority = parseInteger(body.priority ?? existing.priority, "Prioridade", { min: 0, max: 10000 });
      const isActive = boolToInt(body.is_active ?? body.isActive ?? existing.is_active);

      if (!(await ensureCategoryAvailable(env.DB, existing.profile_id, category))) {
        return apiError("A categoria de destino precisa existir para este perfil.", 404);
      }

      const rule = await env.DB
        .prepare(
          `UPDATE category_rules
           SET match_type = ?, pattern = ?, category = ?, priority = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
           RETURNING *`,
        )
        .bind(matchType, pattern, category, priority, isActive, id)
        .first<CategoryRuleRow>();

      return json({ rule });
    }

    if (request.method === "DELETE") {
      if (!schema.hasCategoryRules) {
        return json({ ok: true });
      }

      const body = await readJson<CategoryRuleBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM category_rules WHERE id = ?").bind(id).first<CategoryRuleRow>();
      if (!existing) {
        return json({ ok: true });
      }

      const profileAuth = await requireProfileAccess(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      await env.DB.prepare("DELETE FROM category_rules WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de regras automáticas.", 400);
  }
};
