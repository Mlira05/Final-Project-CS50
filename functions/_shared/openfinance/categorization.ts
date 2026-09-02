// CS50 Final Project — functions/_shared/openfinance/categorization.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import {
  normalizeWithRules,
  type CategoryRuleLike,
  type NormalizeOpenFinanceCategoryInput,
} from "../category-normalizer";
import { getDbFeatureFlags } from "../db-schema";
import type { CategoryRuleRow, OpenFinanceTransactionRow } from "../types";

export function categoryNormalizationInput(
  transaction: Pick<
    OpenFinanceTransactionRow,
    "description" | "merchant_name" | "original_category" | "transaction_kind"
  >,
): NormalizeOpenFinanceCategoryInput {
  return {
    originalCategory: transaction.original_category,
    description: transaction.description,
    merchantName: transaction.merchant_name,
    transactionKind: transaction.transaction_kind,
  };
}

export async function listActiveCategoryRules(db: D1Database, profileId: number) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasCategoryRules) {
    return [];
  }

  const { results = [] } = await db
    .prepare(
      `SELECT *
       FROM category_rules
       WHERE profile_id = ? AND is_active = 1
       ORDER BY priority ASC, created_at ASC, id ASC`,
    )
    .bind(profileId)
    .all<CategoryRuleRow>();

  return results;
}

export function normalizeSystemCategoryForTransaction(
  transaction: Pick<
    OpenFinanceTransactionRow,
    "description" | "merchant_name" | "original_category" | "transaction_kind"
  >,
  rules: CategoryRuleLike[],
) {
  return normalizeWithRules(categoryNormalizationInput(transaction), rules);
}

export async function reprocessTransactionCategories(db: D1Database, profileId: number) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasSystemCategory) {
    return {
      processed: 0,
      updated: 0,
    };
  }

  const rules = await listActiveCategoryRules(db, profileId);
  const { results = [] } = await db
    .prepare(
      `SELECT
         id,
         owner_id,
         description,
         merchant_name,
         original_category,
         system_category,
         user_category,
         transaction_kind,
         posted_at,
         raw_json,
         source,
         source_type,
         source_account_id,
         source_bill_id,
         external_id,
         dedupe_key,
         amount_cents,
         currency,
         created_at,
         updated_at
       FROM open_finance_transactions
       WHERE owner_id = ?
       ORDER BY id ASC`,
    )
    .bind(profileId)
    .all<OpenFinanceTransactionRow>();

  let updated = 0;

  for (const transaction of results) {
    const nextCategory = normalizeSystemCategoryForTransaction(transaction, rules);
    if ((transaction.system_category ?? "") === (nextCategory ?? "")) {
      continue;
    }

    await db
      .prepare(
        `UPDATE open_finance_transactions
         SET system_category = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(nextCategory, transaction.id)
      .run();
    updated += 1;
  }

  return {
    processed: results.length,
    updated,
  };
}
