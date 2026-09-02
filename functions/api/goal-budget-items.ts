// CS50 Final Project — functions/api/goal-budget-items.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../_shared/auth";
import { getDbFeatureFlags } from "../_shared/db-schema";
import {
  apiError,
  json,
  methodNotAllowed,
  optionalText,
  parseId,
  parseNonNegativeAmount,
  readJson,
  requiredText,
} from "../_shared/http";
import { refreshGoalBudgetItemActuals, withBudgetItemCalculations } from "../_shared/goals";
import type { Env, GoalBudgetItemRow, SavingsGoalRow } from "../_shared/types";

interface GoalBudgetItemBody {
  id?: unknown;
  goalId?: unknown;
  goal_id?: unknown;
  name?: unknown;
  category?: unknown;
  plannedAmount?: unknown;
  planned_amount?: unknown;
  notes?: unknown;
}

async function loadGoal(db: D1Database, goalId: number) {
  return db.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(goalId).first<SavingsGoalRow>();
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

      if (!schema.hasGoalBudgetItems) {
        return json({ items: [] });
      }

      await refreshGoalBudgetItemActuals(env.DB, goalId);
      const { results = [] } = await env.DB
        .prepare(
          `SELECT *
           FROM goal_budget_items
           WHERE goal_id = ?
           ORDER BY created_at ASC, id ASC`,
        )
        .bind(goalId)
        .all<GoalBudgetItemRow>();

      return json({ items: results.map(withBudgetItemCalculations) });
    }

    if (request.method === "POST") {
      if (!schema.hasGoalBudgetItems) {
        return apiError("O orçamento por objetivo ainda não está disponível nesta base. Aplique a migration 0004.", 409);
      }

      const body = await readJson<GoalBudgetItemBody>(request);
      const goalId = parseId(body.goal_id ?? body.goalId, "goalId");
      const goal = await loadGoal(env.DB, goalId);
      if (!goal) {
        return apiError("Objetivo não encontrado.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, goal.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const name = requiredText(body.name, "Nome do item");
      const category = requiredText(body.category, "Categoria");
      const plannedAmount = parseNonNegativeAmount(body.planned_amount ?? body.plannedAmount ?? 0, "Valor planejado");
      const notes = optionalText(body.notes);

      const item = await env.DB
        .prepare(
          `INSERT INTO goal_budget_items (goal_id, profile_id, name, category, planned_amount, actual_amount, notes)
           VALUES (?, ?, ?, ?, ?, 0, ?)
           RETURNING *`,
        )
        .bind(goalId, goal.profile_id, name, category, plannedAmount, notes)
        .first<GoalBudgetItemRow>();

      return json({ item: item ? withBudgetItemCalculations(item) : null }, 201);
    }

    if (request.method === "PUT") {
      if (!schema.hasGoalBudgetItems) {
        return apiError("O orçamento por objetivo ainda não está disponível nesta base. Aplique a migration 0004.", 409);
      }

      const body = await readJson<GoalBudgetItemBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM goal_budget_items WHERE id = ?").bind(id).first<GoalBudgetItemRow>();
      if (!existing) {
        return apiError("Item de orçamento não encontrado.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const name = requiredText(body.name ?? existing.name, "Nome do item");
      const category = requiredText(body.category ?? existing.category, "Categoria");
      const plannedAmount = parseNonNegativeAmount(
        body.planned_amount ?? body.plannedAmount ?? existing.planned_amount,
        "Valor planejado",
      );
      const notes = optionalText(body.notes ?? existing.notes);

      const item = await env.DB
        .prepare(
          `UPDATE goal_budget_items
           SET name = ?, category = ?, planned_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
           RETURNING *`,
        )
        .bind(name, category, plannedAmount, notes, id)
        .first<GoalBudgetItemRow>();

      return json({ item: item ? withBudgetItemCalculations(item) : null });
    }

    if (request.method === "DELETE") {
      if (!schema.hasGoalBudgetItems) {
        return json({ ok: true });
      }

      const body = await readJson<GoalBudgetItemBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM goal_budget_items WHERE id = ?").bind(id).first<GoalBudgetItemRow>();
      if (!existing) {
        return json({ ok: true });
      }

      const profileAuth = await requireProfileAccess(request, env, existing.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      await env.DB.prepare("DELETE FROM goal_budget_items WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de orçamento do objetivo.", 400);
  }
};
