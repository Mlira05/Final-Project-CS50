// CS50 Final Project — functions/api/transactions/[id]/details.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../../../_shared/auth";
import {
  effectiveCategorySqlForSchema,
  getDbFeatureFlags,
  openFinanceConnectionIdSelectSql,
  openFinanceSystemCategorySelectSql,
} from "../../../_shared/db-schema";
import { apiError, json, methodNotAllowed, parseId } from "../../../_shared/http";
import { openFinanceFlowSql } from "../../../_shared/openfinance/flow";
import type { Env, OpenFinanceTransactionRow, PublicOpenFinanceTransactionRow } from "../../../_shared/types";

interface OpenFinanceTransactionDetailsRow extends PublicOpenFinanceTransactionRow {
  raw_json: string;
}

function detailsSelectSql(schema: { hasSystemCategory: boolean; hasOpenFinanceConnectionId: boolean }) {
  const effectiveCategorySql = effectiveCategorySqlForSchema(schema);
  const { hasSystemCategory } = schema;
  const flowSql = openFinanceFlowSql({
    userCategorySql: "user_category",
    systemCategorySql: hasSystemCategory ? "system_category" : null,
    originalCategorySql: "original_category",
    transactionKindSql: "transaction_kind",
  });

  return `SELECT
    id, owner_id, ${openFinanceConnectionIdSelectSql(schema)}, source, source_type, source_account_id, source_bill_id, external_id, dedupe_key,
    transaction_kind, amount_cents, currency, description, merchant_name, original_category, ${openFinanceSystemCategorySelectSql(schema)}, user_category,
    posted_at, created_at, updated_at, raw_json,
    ${effectiveCategorySql} AS effective_category,
    ${flowSql} AS flow_type,
    ROUND(amount_cents / 100.0, 2) AS amount
   FROM open_finance_transactions
   WHERE id = ?`;
}

function parseRawJson(rawJson: string) {
  try {
    return JSON.parse(rawJson) as unknown;
  } catch {
    return rawJson;
  }
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  try {
    const id = parseId(params.id, "id");
    const existing = await env.DB.prepare("SELECT * FROM open_finance_transactions WHERE id = ?").bind(id).first<OpenFinanceTransactionRow>();
    if (!existing) {
      return apiError("Transação não encontrada.", 404);
    }

    const auth = await requireProfileAccess(request, env, existing.owner_id);
    if (auth) {
      return auth;
    }

    const schema = await getDbFeatureFlags(env.DB);
    const transaction = await env.DB
      .prepare(detailsSelectSql(schema))
      .bind(id)
      .first<OpenFinanceTransactionDetailsRow>();

    if (!transaction) {
      return apiError("Transação não encontrada.", 404);
    }

    const { raw_json, ...publicTransaction } = transaction;

    return json({
      transaction: publicTransaction,
      rawData: parseRawJson(raw_json),
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível carregar os detalhes da transação.", 400);
  }
};
