// CS50 Final Project — functions/api/savings-goals.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import { getDbFeatureFlags } from "../_shared/db-schema";
import { ensureGoalParticipants, listGoalsWithDetails } from "../_shared/goals";
import {
  apiError,
  boolToInt,
  json,
  methodNotAllowed,
  optionalText,
  parseDate,
  parseEnum,
  parseId,
  parseNonNegativeAmount,
  parsePositiveAmount,
  readJson,
  requiredText,
} from "../_shared/http";
import type { Env, SavingsGoalRow } from "../_shared/types";

interface SavingsGoalBody {
  id?: unknown;
  profile_id?: unknown;
  profileId?: unknown;
  name?: unknown;
  target_amount?: unknown;
  targetAmount?: unknown;
  current_amount?: unknown;
  currentAmount?: unknown;
  deadline?: unknown;
  target_date?: unknown;
  targetDate?: unknown;
  goal_type?: unknown;
  goalType?: unknown;
  priority?: unknown;
  status?: unknown;
  owner_mode?: unknown;
  ownerMode?: unknown;
  notes?: unknown;
  createDefaultBudgetItems?: unknown;
  participantProfileIds?: unknown;
  participant_profile_ids?: unknown;
}

const goalTypes = ["general", "travel", "emergency_reserve", "purchase", "debt_payment", "investment"] as const;
const priorities = ["low", "medium", "high"] as const;
const statuses = ["active", "paused", "completed", "cancelled"] as const;
const ownerModes = ["individual", "shared"] as const;

const travelBudgetSuggestions = [
  "Passagens",
  "Hospedagem",
  "Alimentação",
  "Transporte",
  "Passeios",
  "Carro",
  "Emergência",
  "Outros",
];

async function loadGoalForResponse(db: D1Database, profileId: number, goalId: number) {
  const goals = await listGoalsWithDetails(db, profileId);
  return goals.find((goal) => goal.id === goalId) ?? null;
}

async function insertTravelBudgetSuggestions(db: D1Database, goal: SavingsGoalRow) {
  const schema = await getDbFeatureFlags(db);
  if (!schema.hasGoalBudgetItems) {
    return;
  }

  for (const name of travelBudgetSuggestions) {
    await db
      .prepare(
        `INSERT INTO goal_budget_items (goal_id, profile_id, name, category, planned_amount, actual_amount, notes)
         VALUES (?, ?, ?, ?, 0, 0, NULL)`,
      )
      .bind(goal.id, goal.profile_id, name, name)
      .run();
  }
}

function parseTargetDate(body: SavingsGoalBody, fallback?: string) {
  return parseDate(body.target_date ?? body.targetDate ?? body.deadline ?? fallback, "Data alvo");
}

function parseParticipantProfileIds(body: SavingsGoalBody) {
  const raw = body.participantProfileIds ?? body.participant_profile_ids;
  if (!Array.isArray(raw)) {
    return undefined;
  }

  return raw
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const schema = await getDbFeatureFlags(env.DB);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const profileId = parseId(url.searchParams.get("profileId"), "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      return json({ goals: await listGoalsWithDetails(env.DB, profileId) });
    }

    if (request.method === "POST") {
      const body = await readJson<SavingsGoalBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name, "Nome da meta");
      const targetAmount = parsePositiveAmount(body.target_amount ?? body.targetAmount, "Valor da meta");
      const currentAmount = parseNonNegativeAmount(body.current_amount ?? body.currentAmount ?? 0, "Valor atual");
      const targetDate = parseTargetDate(body);
      const goalType = parseEnum(body.goal_type ?? body.goalType, "Tipo do objetivo", goalTypes, "general");
      const priority = parseEnum(body.priority, "Prioridade", priorities, "medium");
      const status = parseEnum(body.status, "Status", statuses, "active");
      const ownerMode = parseEnum(body.owner_mode ?? body.ownerMode, "Modo de titularidade", ownerModes, "individual");
      const notes = optionalText(body.notes);
      const goal = schema.hasExpandedSavingsGoals
        ? await env.DB
            .prepare(
              `INSERT INTO savings_goals
                (profile_id, name, target_amount, current_amount, deadline, target_date, goal_type, priority, status, owner_mode, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING *`,
            )
            .bind(profileId, name, targetAmount, currentAmount, targetDate, targetDate, goalType, priority, status, ownerMode, notes)
            .first<SavingsGoalRow>()
        : await env.DB
            .prepare(
              `INSERT INTO savings_goals
                (profile_id, name, target_amount, current_amount, deadline, notes)
               VALUES (?, ?, ?, ?, ?, ?)
               RETURNING
                 id,
                 profile_id,
                 name,
                 target_amount,
                 current_amount,
                 deadline,
                 deadline AS target_date,
                 'general' AS goal_type,
                 'medium' AS priority,
                 'active' AS status,
                 'individual' AS owner_mode,
                 notes,
                 created_at,
                 updated_at`,
            )
            .bind(profileId, name, targetAmount, currentAmount, targetDate, notes)
            .first<SavingsGoalRow>();

      if (!goal) {
        return apiError("Não foi possível criar o objetivo.", 500);
      }

      if (goalType === "travel" && boolToInt(body.createDefaultBudgetItems) === 1) {
        await insertTravelBudgetSuggestions(env.DB, goal);
      }
      await ensureGoalParticipants(env.DB, goal.id, profileId, ownerMode, parseParticipantProfileIds(body));

      return json({ goal: await loadGoalForResponse(env.DB, profileId, goal.id) }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<SavingsGoalBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(id).first<SavingsGoalRow>();
      if (!existing) {
        return apiError("Meta não encontrada.", 404);
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name ?? existing.name, "Nome da meta");
      const targetAmount = parsePositiveAmount(body.target_amount ?? body.targetAmount ?? existing.target_amount, "Valor da meta");
      const currentAmount = parseNonNegativeAmount(
        body.current_amount ?? body.currentAmount ?? existing.current_amount,
        "Valor atual",
      );
      const targetDate = parseTargetDate(body, existing.target_date ?? existing.deadline);
      const goalType = parseEnum(body.goal_type ?? body.goalType ?? existing.goal_type, "Tipo do objetivo", goalTypes);
      const priority = parseEnum(body.priority ?? existing.priority, "Prioridade", priorities);
      const status = parseEnum(body.status ?? existing.status, "Status", statuses);
      const ownerMode = parseEnum(body.owner_mode ?? body.ownerMode ?? existing.owner_mode, "Modo de titularidade", ownerModes);
      const notes = optionalText(body.notes ?? existing.notes);

      if (schema.hasExpandedSavingsGoals) {
        await env.DB
          .prepare(
            `UPDATE savings_goals
             SET name = ?,
                 target_amount = ?,
                 current_amount = ?,
                 deadline = ?,
                 target_date = ?,
                 goal_type = ?,
                 priority = ?,
                 status = ?,
                 owner_mode = ?,
                 notes = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(name, targetAmount, currentAmount, targetDate, targetDate, goalType, priority, status, ownerMode, notes, id)
          .run();
      } else {
        await env.DB
          .prepare(
            `UPDATE savings_goals
             SET name = ?,
                 target_amount = ?,
                 current_amount = ?,
                 deadline = ?,
                 notes = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(name, targetAmount, currentAmount, targetDate, notes, id)
          .run();
      }

      await ensureGoalParticipants(env.DB, id, existing.profile_id, ownerMode, parseParticipantProfileIds(body));

      return json({ goal: await loadGoalForResponse(env.DB, existing.profile_id, id) });
    }

    if (request.method === "DELETE") {
      const body = await readJson<SavingsGoalBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(id).first<SavingsGoalRow>();
      if (existing) {
        const auth = await requireProfileAccess(request, env, existing.profile_id);
        if (auth) {
          return auth;
        }
      }

      await env.DB.prepare("DELETE FROM savings_goals WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de metas.", 400);
  }
};
