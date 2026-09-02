// CS50 Final Project — functions/api/savings-goals/contributions.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { refreshGoalBudgetItemRollups } from "../../_shared/goals";
import { apiError, json, methodNotAllowed, parseId, readJson } from "../../_shared/http";
import type { Env, GoalContributionRow, SavingsGoalRow } from "../../_shared/types";

interface ContributionBody {
  id?: unknown;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth) {
    return auth;
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const goalId = parseId(url.searchParams.get("goalId"), "goalId");
      const goal = await env.DB.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(goalId).first<SavingsGoalRow>();
      if (!goal) {
        return apiError("Meta não encontrada.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, goal.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      const { results = [] } = await env.DB
        .prepare(
          `SELECT *
           FROM goal_contributions
           WHERE goal_id = ?
           ORDER BY contribution_date DESC, created_at DESC`,
        )
        .bind(goalId)
        .all<GoalContributionRow>();

      return json({ contributions: results });
    }

    if (request.method === "DELETE") {
      const body = await readJson<ContributionBody>(request);
      const id = parseId(body.id);
      const contribution = await env.DB
        .prepare("SELECT * FROM goal_contributions WHERE id = ?")
        .bind(id)
        .first<GoalContributionRow>();
      if (!contribution) {
        return json({ ok: true });
      }

      const goal = await env.DB.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(contribution.goal_id).first<SavingsGoalRow>();
      if (!goal) {
        return apiError("Meta não encontrada.", 404);
      }

      const profileAuth = await requireProfileAccess(request, env, goal.profile_id);
      if (profileAuth) {
        return profileAuth;
      }

      if (goal.current_amount - contribution.amount < 0) {
        return apiError("Excluir este aporte deixaria a meta com valor negativo.", 409);
      }

      const schema = await getDbFeatureFlags(env.DB);
      if (schema.hasGoalBudgetAllocations) {
        await env.DB
          .prepare("DELETE FROM goal_budget_allocations WHERE source_type = 'contribution' AND source_id = ?")
          .bind(id)
          .run();
      }
      await env.DB.prepare("DELETE FROM goal_contributions WHERE id = ?").bind(id).run();
      await env.DB
        .prepare(
          `UPDATE savings_goals
           SET current_amount = current_amount - ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(contribution.amount, goal.id)
        .run();
      await refreshGoalBudgetItemRollups(env.DB, goal.id);

      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de aportes.", 400);
  }
};
