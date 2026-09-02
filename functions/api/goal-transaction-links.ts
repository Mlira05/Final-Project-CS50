// CS50 Final Project — functions/api/goal-transaction-links.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../_shared/auth";
import { effectiveCategorySqlForSchema, getDbFeatureFlags } from "../_shared/db-schema";
import { allocateAmountAcrossGoalBudgetItems, refreshBudgetItemActualAmount, refreshGoalBudgetItemRollups } from "../_shared/goals";
import { apiError, json, methodNotAllowed, optionalText, parseId, readJson } from "../_shared/http";
import { resolveOpenFinanceFlow } from "../_shared/openfinance/flow";
import type {
  Env,
  GoalBudgetItemRow,
  GoalTransactionLinkRow,
  OpenFinanceTransactionRow,
  SavingsGoalRow,
} from "../_shared/types";

interface GoalTransactionLinkBody {
  id?: unknown;
  goalId?: unknown;
  goal_id?: unknown;
  transactionId?: unknown;
  transaction_id?: unknown;
  budgetItemId?: unknown;
  budget_item_id?: unknown;
  notes?: unknown;
  autoAllocate?: unknown;
  auto_allocate?: unknown;
  allocationStrategy?: unknown;
  allocation_strategy?: unknown;
}

interface GoalLinkedTransactionRow extends GoalTransactionLinkRow {
  budget_item_name: string | null;
  transaction_amount: number;
  transaction_posted_at: string;
  transaction_description: string;
  transaction_merchant_name: string | null;
  transaction_kind: string;
  transaction_effective_category: string;
  transaction_source_type: string;
}

async function loadGoal(db: D1Database, goalId: number) {
  return db.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(goalId).first<SavingsGoalRow>();
}

async function listGoalLinks(
  db: D1Database,
  goalId: number,
  options: { hasGoalBudgetItems: boolean; hasSystemCategory: boolean; hasGoalTransactionLinks: boolean },
) {
  if (!options.hasGoalTransactionLinks) {
    return [];
  }

  const { results = [] } = await db
    .prepare(
      `SELECT
         gtl.id,
         gtl.goal_id,
         gtl.transaction_id,
         gtl.profile_id,
         gtl.budget_item_id,
         gtl.notes,
         gtl.created_at,
         ${options.hasGoalBudgetItems ? "gbi.name AS budget_item_name" : "NULL AS budget_item_name"},
         ROUND(oft.amount_cents / 100.0, 2) AS transaction_amount,
         oft.posted_at AS transaction_posted_at,
         oft.description AS transaction_description,
         oft.merchant_name AS transaction_merchant_name,
         oft.transaction_kind AS transaction_kind,
         ${effectiveCategorySqlForSchema(options)} AS transaction_effective_category,
         oft.source_type AS transaction_source_type
       FROM goal_transaction_links gtl
       JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
       ${options.hasGoalBudgetItems ? "LEFT JOIN goal_budget_items gbi ON gbi.id = gtl.budget_item_id" : ""}
       WHERE gtl.goal_id = ?
       ORDER BY oft.posted_at DESC, gtl.id DESC`,
    )
    .bind(goalId)
    .all<GoalLinkedTransactionRow>();

  return results;
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
      const goalId = parseId(url.searchParams.get("goalId"), "goalId");
      const goal = await loadGoal(env.DB, goalId);
      if (!goal) {
        return apiError("Objetivo não encontrado.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, goal.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      return json({ links: await listGoalLinks(env.DB, goalId, schema) });
    }

    if (request.method === "POST") {
      if (!schema.hasGoalTransactionLinks) {
        return apiError("Os vínculos entre transações e objetivos ainda não estão disponíveis nesta base. Aplique a migration 0004.", 409);
      }

      const body = await readJson<GoalTransactionLinkBody>(request);
      const goalId = parseId(body.goal_id ?? body.goalId, "goalId");
      const transactionId = parseId(body.transaction_id ?? body.transactionId, "transactionId");
      const budgetItemIdRaw = body.budget_item_id ?? body.budgetItemId;
      const budgetItemId = budgetItemIdRaw === undefined || budgetItemIdRaw === null || budgetItemIdRaw === "" ? null : parseId(budgetItemIdRaw, "budgetItemId");
      const notes = optionalText(body.notes);

      const goal = await loadGoal(env.DB, goalId);
      if (!goal) {
        return apiError("Objetivo não encontrado.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, goal.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const transaction = await env.DB
        .prepare("SELECT * FROM open_finance_transactions WHERE id = ?")
        .bind(transactionId)
        .first<OpenFinanceTransactionRow>();
      if (!transaction) {
        return apiError("Transação não encontrada para este perfil.", 404);
      }

      const transactionFlow = resolveOpenFinanceFlow({
        effectiveCategory:
          transaction.user_category?.trim() ||
          transaction.system_category?.trim() ||
          transaction.original_category?.trim() ||
          "Sem categoria",
        transactionKind: transaction.transaction_kind,
      });

      if (transactionFlow !== "expense") {
        return apiError("Só é possível vincular despesas importadas a objetivos.", 400);
      }

      if (budgetItemId && schema.hasGoalBudgetItems) {
        const budgetItem = await env.DB
          .prepare("SELECT * FROM goal_budget_items WHERE id = ?")
          .bind(budgetItemId)
          .first<GoalBudgetItemRow>();
        if (!budgetItem || budgetItem.goal_id !== goal.id) {
          return apiError("O item de orçamento precisa pertencer ao objetivo selecionado.", 404);
        }
      }

      let insertedLink: GoalTransactionLinkRow | null = null;
      try {
        insertedLink = await env.DB
          .prepare(
            `INSERT INTO goal_transaction_links (goal_id, transaction_id, profile_id, budget_item_id, notes)
             VALUES (?, ?, ?, ?, ?)
             RETURNING *`,
          )
          .bind(goalId, transactionId, transaction.owner_id, budgetItemId, notes)
          .first<GoalTransactionLinkRow>();
      } catch (error) {
        if (error instanceof Error && /UNIQUE/i.test(error.message)) {
          return apiError("Essa transação já está vinculada a este objetivo.", 409);
        }

        throw error;
      }

      const amount = Math.round((Math.abs(transaction.amount_cents) / 100) * 100) / 100;
      if (budgetItemId && schema.hasGoalBudgetAllocations) {
        await env.DB
          .prepare(
            `INSERT INTO goal_budget_allocations
              (goal_id, budget_item_id, profile_id, source_type, source_id, amount, notes)
             VALUES (?, ?, ?, 'transaction', ?, ?, ?)`,
          )
          .bind(goalId, budgetItemId, transaction.owner_id, insertedLink?.id ?? null, amount, notes)
          .run();
        await refreshGoalBudgetItemRollups(env.DB, goalId);
      } else if (budgetItemId) {
        await refreshBudgetItemActualAmount(env.DB, budgetItemId);
      } else if ((body.autoAllocate ?? body.auto_allocate) !== false) {
        await allocateAmountAcrossGoalBudgetItems(env.DB, {
          goalId,
          profileId: transaction.owner_id,
          amount,
          sourceType: "transaction",
          sourceId: insertedLink?.id ?? null,
          strategy: String(body.allocationStrategy ?? body.allocation_strategy ?? "largest_first") as
            | "largest_first"
            | "smallest_first"
            | "manual_order",
          notes,
        });
      }

      return json({ links: await listGoalLinks(env.DB, goalId, schema) }, 201);
    }

    if (request.method === "DELETE") {
      if (!schema.hasGoalTransactionLinks) {
        return json({ ok: true });
      }

      const body = await readJson<GoalTransactionLinkBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB
        .prepare("SELECT * FROM goal_transaction_links WHERE id = ?")
        .bind(id)
        .first<GoalTransactionLinkRow>();
      if (!existing) {
        return json({ ok: true });
      }

      const profileAuth = await requireProfileAccess(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      await env.DB.prepare("DELETE FROM goal_transaction_links WHERE id = ?").bind(id).run();
      if (schema.hasGoalBudgetAllocations) {
        await env.DB
          .prepare("DELETE FROM goal_budget_allocations WHERE source_type = 'transaction' AND source_id = ?")
          .bind(id)
          .run();
        await refreshGoalBudgetItemRollups(env.DB, existing.goal_id);
      }
      if (existing.budget_item_id) {
        await refreshBudgetItemActualAmount(env.DB, existing.budget_item_id);
      }

      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de vínculos com objetivos.", 400);
  }
};
