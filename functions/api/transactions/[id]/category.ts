// CS50 Final Project — functions/api/transactions/[id]/category.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../../../_shared/auth";
import {
  effectiveCategorySqlForSchema,
  getDbFeatureFlags,
  openFinanceConnectionIdSelectSql,
  openFinanceSystemCategorySelectSql,
} from "../../../_shared/db-schema";
import { refreshBudgetItemsLinkedToTransactions } from "../../../_shared/goals";
import { apiError, json, methodNotAllowed, optionalText, parseId, readJson } from "../../../_shared/http";
import { openFinanceFlowSql } from "../../../_shared/openfinance/flow";
import type { Env, OpenFinanceTransactionRow, PublicOpenFinanceTransactionRow } from "../../../_shared/types";

interface CategoryBody {
  userCategory?: unknown;
  user_category?: unknown;
}

function publicTransactionSelect(schema: { hasSystemCategory: boolean; hasOpenFinanceConnectionId: boolean }) {
  const effectiveCategorySql = effectiveCategorySqlForSchema(schema);
  const flowSql = openFinanceFlowSql({
    userCategorySql: "user_category",
    systemCategorySql: schema.hasSystemCategory ? "system_category" : null,
    originalCategorySql: "original_category",
    transactionKindSql: "transaction_kind",
  });
  return `SELECT
    id, owner_id, ${openFinanceConnectionIdSelectSql(schema)}, source, source_type, source_account_id, source_bill_id, external_id, dedupe_key,
    transaction_kind, amount_cents, currency, description, merchant_name, original_category, ${openFinanceSystemCategorySelectSql(schema)}, user_category,
    posted_at, created_at, updated_at,
    ${effectiveCategorySql} AS effective_category,
    ${flowSql} AS flow_type,
    ROUND(amount_cents / 100.0, 2) AS amount
   FROM open_finance_transactions
   WHERE id = ?`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method !== "PATCH") {
    return methodNotAllowed();
  }

  try {
    const id = parseId(params.id, "id");
    const existing = await env.DB.prepare("SELECT * FROM open_finance_transactions WHERE id = ?")
      .bind(id)
      .first<OpenFinanceTransactionRow>();
    if (!existing) {
      return apiError("Transação não encontrada.", 404);
    }

    const auth = await requireProfileAccess(request, env, existing.owner_id);
    if (auth) {
      return auth;
    }

    const body = await readJson<CategoryBody>(request);
    const userCategory = optionalText(body.userCategory ?? body.user_category);
    if (userCategory) {
      const { results = [] } = await env.DB
        .prepare("SELECT id FROM categories WHERE (profile_id IS NULL OR profile_id = ?) AND name = ?")
        .bind(existing.owner_id, userCategory)
        .all<{ id: number }>();
      if (!results.length) {
        return apiError("A categoria escolhida não existe para este perfil.", 404);
      }
    }

    await env.DB.prepare(
      "UPDATE open_finance_transactions SET user_category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(userCategory, id)
      .run();

    await refreshBudgetItemsLinkedToTransactions(env.DB, [id]);

    const schema = await getDbFeatureFlags(env.DB);
    const transaction = await env.DB
      .prepare(publicTransactionSelect(schema))
      .bind(id)
      .first<PublicOpenFinanceTransactionRow>();

    return json({ transaction });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível alterar a categoria.", 400);
  }
};
