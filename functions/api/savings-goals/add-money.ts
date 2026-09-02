// CS50 Final Project — functions/api/savings-goals/add-money.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireAuth, requireProfileAccess } from "../../_shared/auth";
import { getDbFeatureFlags } from "../../_shared/db-schema";
import { allocateAmountAcrossGoalBudgetItems, listGoalsWithDetails, type AllocationStrategy } from "../../_shared/goals";
import {
  apiError,
  json,
  methodNotAllowed,
  optionalText,
  parseDate,
  parseId,
  parsePositiveAmount,
  readJson,
} from "../../_shared/http";
import type { Env, GoalContributionRow, SavingsGoalRow } from "../../_shared/types";

interface AddMoneyBody {
  goalId?: unknown;
  goal_id?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  amount?: unknown;
  contributionDate?: unknown;
  contribution_date?: unknown;
  source?: unknown;
  notes?: unknown;
  autoAllocate?: unknown;
  auto_allocate?: unknown;
  allocationStrategy?: unknown;
  allocation_strategy?: unknown;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function loadGoalWithDetails(db: D1Database, profileId: number, goalId: number) {
  const goals = await listGoalsWithDetails(db, profileId);
  return goals.find((goal) => goal.id === goalId) ?? null;
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
    const schema = await getDbFeatureFlags(env.DB);
    const body = await readJson<AddMoneyBody>(request);
    const goalId = parseId(body.goal_id ?? body.goalId, "goalId");
    const contributorProfileIdRaw = body.profile_id ?? body.profileId;
    const amount = parsePositiveAmount(body.amount, "Valor do aporte");
    const contributionDate = parseDate(body.contribution_date ?? body.contributionDate ?? todayIsoDate(), "Data do aporte");
    const source = optionalText(body.source);
    const notes = optionalText(body.notes);

    const existing = await env.DB.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(goalId).first<SavingsGoalRow>();
    if (!existing) {
      return apiError("Meta não encontrada.", 404);
    }

    const contributorProfileId = contributorProfileIdRaw ? parseId(contributorProfileIdRaw, "profileId") : existing.profile_id;
    const profileAuth = await requireProfileAccess(request, env, contributorProfileId);
    if (profileAuth) {
      return profileAuth;
    }

    const contribution = schema.hasGoalContributions
      ? await env.DB
          .prepare(
            `INSERT INTO goal_contributions (goal_id, profile_id, amount, contribution_date, source, notes)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING *`,
          )
          .bind(goalId, contributorProfileId, amount, contributionDate, source, notes)
          .first<GoalContributionRow>()
      : null;

    await env.DB
      .prepare(
        `UPDATE savings_goals
         SET current_amount = current_amount + ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(amount, goalId)
      .run();

    const autoAllocate = body.autoAllocate ?? body.auto_allocate;
    const allocationStrategy = String(body.allocationStrategy ?? body.allocation_strategy ?? "largest_first") as AllocationStrategy;
    const allocation =
      autoAllocate === false
        ? null
        : await allocateAmountAcrossGoalBudgetItems(env.DB, {
            goalId,
            profileId: contributorProfileId,
            amount,
            sourceType: "contribution",
            sourceId: contribution?.id ?? null,
            strategy: allocationStrategy,
            notes,
          });

    return json({
      contribution,
      allocation,
      goal: await loadGoalWithDetails(env.DB, existing.profile_id, goalId),
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Não foi possível adicionar o valor à meta.", 400);
  }
};
