// CS50 Final Project — functions/api/transactions/apply-similar.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { refreshBudgetItemsLinkedToTransactions } from "../../_shared/goals";
import { apiError, json, methodNotAllowed, parseId, readJson, requiredText } from "../../_shared/http";
import type { CategoryRow, CategoryRuleRow, Env, OpenFinanceTransactionRow } from "../../_shared/types";

interface ApplySimilarBody {
  transactionId?: unknown;
  transaction_id?: unknown;
  category?: unknown;
  userCategory?: unknown;
  user_category?: unknown;
}

interface CountRow {
  total: number;
}

interface IdRow {
  id: number;
}

async function ensureCategoryAvailable(db: D1Database, profileId: number, categoryName: string) {
  const { results = [] } = await db
    .prepare("SELECT * FROM categories WHERE profile_id IS NULL OR profile_id = ?")
    .bind(profileId)
    .all<CategoryRow>();

  return results.some((category) => category.name === categoryName);
}

async function upsertCategoryRule(
  db: D1Database,
  profileId: number,
  matchType: "merchant" | "description",
  pattern: string,
  category: string,
) {
  const existing = await db
    .prepare(
      `SELECT *
       FROM category_rules
       WHERE profile_id = ? AND match_type = ? AND pattern = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .bind(profileId, matchType, pattern)
    .first<CategoryRuleRow>();

  if (existing) {
    await db
      .prepare(
        `UPDATE category_rules
         SET category = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(category, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO category_rules (profile_id, match_type, pattern, category, priority, is_active)
       VALUES (?, ?, ?, ?, 20, 1)`,
    )
    .bind(profileId, matchType, pattern, category)
    .run();
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
    const body = await readJson<ApplySimilarBody>(request);
    const transactionId = parseId(body.transactionId ?? body.transaction_id, "transactionId");
    const category = requiredText(body.userCategory ?? body.user_category ?? body.category, "Categoria");
    if (category === "Sem categoria") {
      return apiError("Escolha uma categoria antes de aplicar para transações parecidas.", 400);
    }

    const transaction = await env.DB
      .prepare("SELECT * FROM open_finance_transactions WHERE id = ?")
      .bind(transactionId)
      .first<OpenFinanceTransactionRow>();
    if (!transaction) {
      return apiError("Transação não encontrada.", 404);
    }

    const profileAuth = await requireProfileAccess(request, env, transaction.owner_id);
    if (profileAuth) {
      return profileAuth;
    }

    if (!(await ensureCategoryAvailable(env.DB, transaction.owner_id, category))) {
      return apiError("A categoria escolhida não existe para este perfil.", 404);
    }

    const pattern = transaction.merchant_name?.trim() || transaction.description.trim();
    const matchType = transaction.merchant_name?.trim() ? "merchant" : "description";
    if (!pattern) {
      return apiError("Essa transação não tem dados suficientes para aplicar a categoria em lote.", 400);
    }

    const whereClause =
      matchType === "merchant" ? "TRIM(COALESCE(merchant_name, '')) = ?" : "TRIM(COALESCE(description, '')) = ?";

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS total
         FROM open_finance_transactions
         WHERE owner_id = ?
           AND ${whereClause}`,
      )
      .bind(transaction.owner_id, pattern)
      .first<CountRow>();

    const { results: matchingTransactions = [] } = await env.DB
      .prepare(
        `SELECT id
         FROM open_finance_transactions
         WHERE owner_id = ?
           AND ${whereClause}`,
      )
      .bind(transaction.owner_id, pattern)
      .all<IdRow>();

    await env.DB
      .prepare(
        `UPDATE open_finance_transactions
         SET user_category = ?, updated_at = CURRENT_TIMESTAMP
         WHERE owner_id = ?
           AND ${whereClause}`,
      )
      .bind(category, transaction.owner_id, pattern)
      .run();

    await refreshBudgetItemsLinkedToTransactions(
      env.DB,
      matchingTransactions.map((item) => item.id),
    );

    const schema = await getDbFeatureFlags(env.DB);
    const futureAutomatic = schema.hasCategoryRules && schema.hasSystemCategory;
    if (futureAutomatic) {
      await upsertCategoryRule(env.DB, transaction.owner_id, matchType, pattern, category);
    }

    return json({
      ok: true,
      appliedCount: countRow?.total ?? 0,
      category,
      pattern,
      matchType,
      futureAutomatic,
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível aplicar a categoria em lote.", 400);
  }
};
