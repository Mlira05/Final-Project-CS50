// CS50 Final Project — functions/api/categories.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../_shared/auth";
import { getDbFeatureFlags } from "../_shared/db-schema";
import {
  apiError,
  json,
  methodNotAllowed,
  optionalText,
  parseColor,
  parseId,
  readJson,
  requiredText,
} from "../_shared/http";
import type { CategoryRow, Env } from "../_shared/types";

interface CategoryBody {
  id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  name?: unknown;
  color?: unknown;
  replacementCategory?: unknown;
  replacement_category?: unknown;
}

interface CountRow {
  total: number;
}

async function listCategories(db: D1Database, profileId: number | null) {
  const { results } = profileId
    ? await db
        .prepare(
          `SELECT *
           FROM categories
           WHERE profile_id IS NULL OR profile_id = ?
           ORDER BY profile_id ASC, name ASC`,
        )
        .bind(profileId)
        .all<CategoryRow>()
    : await db
        .prepare(
          `SELECT *
           FROM categories
           WHERE profile_id IS NULL
           ORDER BY name ASC`,
        )
        .all<CategoryRow>();

  return results ?? [];
}

async function findVisibleCategoryByName(db: D1Database, profileId: number, name: string, excludeId?: number) {
  const categories = await listCategories(db, profileId);

  return (
    categories.find((category) => {
      if (excludeId && category.id === excludeId) {
        return false;
      }

      return category.name.localeCompare(name, "pt-BR", { sensitivity: "accent" }) === 0;
    }) ?? null
  );
}

async function ensureMutableCategory(request: Request, env: Env, id: number) {
  const existing = await env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first<CategoryRow>();
  if (!existing) {
    return { error: apiError("Categoria não encontrada.", 404), category: null };
  }

  if (existing.profile_id === null) {
    return {
      error: apiError("Categorias globais são somente leitura para preservar o catálogo base.", 400),
      category: null,
    };
  }

  const auth = await requireProfileAccess(request, env, existing.profile_id);
  if (auth) {
    return { error: auth, category: null };
  }

  return { error: null, category: existing };
}

async function countCategoryUsage(
  db: D1Database,
  profileId: number,
  categoryName: string,
  schema: Awaited<ReturnType<typeof getDbFeatureFlags>>,
) {
  const manualExpenses = await db
    .prepare("SELECT COUNT(*) AS total FROM expenses WHERE profile_id = ? AND category = ?")
    .bind(profileId, categoryName)
    .first<CountRow>();
  const transactionOverrides = await db
    .prepare("SELECT COUNT(*) AS total FROM open_finance_transactions WHERE owner_id = ? AND user_category = ?")
    .bind(profileId, categoryName)
    .first<CountRow>();
  const ruleCount = schema.hasCategoryRules
    ? await db
        .prepare("SELECT COUNT(*) AS total FROM category_rules WHERE profile_id = ? AND category = ?")
        .bind(profileId, categoryName)
        .first<CountRow>()
    : null;
  const budgetItemCount = schema.hasGoalBudgetItems
    ? await db
        .prepare("SELECT COUNT(*) AS total FROM goal_budget_items WHERE profile_id = ? AND category = ?")
        .bind(profileId, categoryName)
        .first<CountRow>()
    : null;

  return {
    manualExpenses: manualExpenses?.total ?? 0,
    transactionOverrides: transactionOverrides?.total ?? 0,
    ruleCount: ruleCount?.total ?? 0,
    budgetItemCount: budgetItemCount?.total ?? 0,
  };
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
      const profileIdParam = url.searchParams.get("profileId");
      const profileId = profileIdParam ? parseId(profileIdParam, "profileId") : null;
      if (profileId) {
        const profileAuth = await requireProfileAccess(request, env, profileId);
        if (profileAuth) {
          return profileAuth;
        }
      }

      return json({ categories: await listCategories(env.DB, profileId) });
    }

    if (request.method === "POST") {
      const body = await readJson<CategoryBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const profileAuth = await requireProfileAccess(request, env, profileId);
      if (profileAuth) {
        return profileAuth;
      }

      const name = requiredText(body.name, "Nome da categoria");
      const color = parseColor(body.color);
      const existing = await findVisibleCategoryByName(env.DB, profileId, name);
      if (existing) {
        return apiError("Já existe uma categoria com esse nome para este perfil.", 409);
      }

      const category = await env.DB
        .prepare(
          `INSERT INTO categories (profile_id, name, color)
           VALUES (?, ?, ?)
           RETURNING *`,
        )
        .bind(profileId, name, color)
        .first<CategoryRow>();

      return json({ category }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<CategoryBody>(request);
      const id = parseId(body.id);
      const { error, category: existing } = await ensureMutableCategory(request, env, id);
      if (error || !existing) {
        return error;
      }

      const name = requiredText(body.name, "Nome da categoria");
      const color = parseColor(body.color ?? existing.color);
      const conflicting = await findVisibleCategoryByName(env.DB, existing.profile_id ?? 0, name, existing.id);
      if (conflicting) {
        return apiError("Já existe uma categoria com esse nome para este perfil.", 409);
      }

      const category = await env.DB
        .prepare(
          `UPDATE categories
           SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
           RETURNING *`,
        )
        .bind(name, color, id)
        .first<CategoryRow>();

      return json({ category });
    }

    if (request.method === "DELETE") {
      const body = await readJson<CategoryBody>(request);
      const id = parseId(body.id);
      const { error, category: existing } = await ensureMutableCategory(request, env, id);
      if (error || !existing) {
        return error;
      }

      const profileId = existing.profile_id ?? 0;
      const replacementCategory = optionalText(body.replacementCategory ?? body.replacement_category);
      const usage = await countCategoryUsage(env.DB, profileId, existing.name, schema);
      const isInUse = Object.values(usage).some((count) => count > 0);

      if (isInUse && !replacementCategory) {
        return apiError(
          "A categoria está em uso. Informe uma categoria substituta para migrar despesas, regras e ajustes manuais.",
          409,
          usage,
        );
      }

      if (replacementCategory) {
        if (replacementCategory === existing.name) {
          return apiError("Escolha uma categoria substituta diferente da categoria atual.", 400);
        }

        const replacement = await findVisibleCategoryByName(env.DB, profileId, replacementCategory);
        if (!replacement) {
          return apiError("A categoria substituta precisa existir para este perfil.", 404);
        }

        await env.DB.prepare("UPDATE expenses SET category = ? WHERE profile_id = ? AND category = ?")
          .bind(replacement.name, profileId, existing.name)
          .run();
        await env.DB
          .prepare(
            `UPDATE open_finance_transactions
             SET user_category = ?, updated_at = CURRENT_TIMESTAMP
             WHERE owner_id = ? AND user_category = ?`,
          )
          .bind(replacement.name, profileId, existing.name)
          .run();
        if (schema.hasCategoryRules) {
          await env.DB
            .prepare(
              `UPDATE category_rules
               SET category = ?, updated_at = CURRENT_TIMESTAMP
               WHERE profile_id = ? AND category = ?`,
            )
            .bind(replacement.name, profileId, existing.name)
            .run();
        }
        if (schema.hasGoalBudgetItems) {
          await env.DB
            .prepare(
              `UPDATE goal_budget_items
               SET category = ?, updated_at = CURRENT_TIMESTAMP
               WHERE profile_id = ? AND category = ?`,
            )
            .bind(replacement.name, profileId, existing.name)
            .run();
        }
      }

      await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
      return json({ ok: true, usageMigrated: usage });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de categorias.", 400);
  }
};
