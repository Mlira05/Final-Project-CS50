// CS50 Final Project — functions/api/transactions.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import {
  effectiveCategorySqlForSchema,
  getDbFeatureFlags,
  openFinanceConnectionIdSelectSql,
  openFinanceSystemCategorySelectSql,
} from "../_shared/db-schema";
import { apiError, json, methodNotAllowed, monthRange, parseId, parseMonth, parseYear } from "../_shared/http";
import { openFinanceFlowSql } from "../_shared/openfinance/flow";
import type { Env, PublicOpenFinanceTransactionRow } from "../_shared/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== "GET") {
    return methodNotAllowed();
  }

  try {
    const url = new URL(request.url);
    const profileId = parseId(url.searchParams.get("profileId"), "profileId");
    const auth = await requireProfileAccess(request, env, profileId);
    if (auth) {
      return auth;
    }

    const month = parseMonth(url.searchParams.get("month"));
    const year = parseYear(url.searchParams.get("year"));
    const category = url.searchParams.get("category");
    const kind = url.searchParams.get("kind");
    const flow = url.searchParams.get("flow");
    const schema = await getDbFeatureFlags(env.DB);
    const effectiveCategorySql = effectiveCategorySqlForSchema(schema);
    const flowSql = openFinanceFlowSql({
      userCategorySql: "user_category",
      systemCategorySql: schema.hasSystemCategory ? "system_category" : null,
      originalCategorySql: "original_category",
      transactionKindSql: "transaction_kind",
    });
    const { start, end } = monthRange(month, year);
    const clauses = ["owner_id = ?", "posted_at >= ?", "posted_at < ?"];
    const bindings: Array<number | string> = [profileId, start, end];

    if (category && category !== "all") {
      clauses.push(`${effectiveCategorySql} = ?`);
      bindings.push(category);
    }

    if (kind && kind !== "all") {
      clauses.push("transaction_kind = ?");
      bindings.push(kind);
    }

    if (flow && flow !== "all") {
      clauses.push(`${flowSql} = ?`);
      bindings.push(flow);
    }

    const { results = [] } = await env.DB.prepare(
      `SELECT
        id, owner_id, ${openFinanceConnectionIdSelectSql(schema)}, source, source_type, source_account_id, source_bill_id, external_id, dedupe_key,
        transaction_kind, amount_cents, currency, description, merchant_name, original_category, ${openFinanceSystemCategorySelectSql(schema)}, user_category,
        posted_at, created_at, updated_at,
        ${effectiveCategorySql} AS effective_category,
        ${flowSql} AS flow_type,
        ROUND(amount_cents / 100.0, 2) AS amount
       FROM open_finance_transactions
       WHERE ${clauses.join(" AND ")}
       ORDER BY posted_at DESC, id DESC
       LIMIT 300`,
    )
      .bind(...bindings)
      .all<PublicOpenFinanceTransactionRow>();

    return json({ transactions: results });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível carregar as transações.", 400);
  }
};
