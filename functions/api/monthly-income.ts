// CS50 Final Project — functions/api/monthly-income.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import {
  apiError,
  boolToInt,
  json,
  methodNotAllowed,
  optionalText,
  parseId,
  parseMonth,
  parsePositiveAmount,
  parseYear,
  readJson,
} from "../_shared/http";
import { listMonths, monthKey, normalizeIncomeEnd, randomGroupId } from "../_shared/recurrence";
import type { Env, MonthlyIncomeRow } from "../_shared/types";

interface IncomeBody {
  id?: unknown;
  profile_id?: unknown;
  profileId?: unknown;
  month?: unknown;
  year?: unknown;
  amount?: unknown;
  notes?: unknown;
  is_recurring?: unknown;
  isRecurring?: unknown;
  recurrenceEndMonth?: unknown;
  recurrence_end_month?: unknown;
  recurrenceEndYear?: unknown;
  recurrence_end_year?: unknown;
  applyToFuture?: unknown;
}

interface IncomeSeriesParams {
  profileId: number;
  month: number;
  year: number;
  amount: number;
  notes: string | null;
  groupId: string;
  endMonth: number;
  endYear: number;
}

async function upsertIncomeSeries(db: D1Database, params: IncomeSeriesParams) {
  let selected: MonthlyIncomeRow | null = null;
  const months = listMonths(params.month, params.year, params.endMonth, params.endYear);

  for (const point of months) {
    const row = await db.prepare(
      `INSERT INTO monthly_income
        (profile_id, month, year, amount, notes, is_recurring, recurrence_group_id, recurrence_start_month, recurrence_start_year, recurrence_end_month, recurrence_end_year)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, month, year) DO UPDATE SET
        amount = excluded.amount,
        notes = excluded.notes,
        is_recurring = 1,
        recurrence_group_id = excluded.recurrence_group_id,
        recurrence_start_month = excluded.recurrence_start_month,
        recurrence_start_year = excluded.recurrence_start_year,
        recurrence_end_month = excluded.recurrence_end_month,
        recurrence_end_year = excluded.recurrence_end_year,
        updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
    )
      .bind(
        params.profileId,
        point.month,
        point.year,
        params.amount,
        params.notes,
        params.groupId,
        params.month,
        params.year,
        params.endMonth,
        params.endYear,
      )
      .first<MonthlyIncomeRow>();

    if (point.month === params.month && point.year === params.year) {
      selected = row ?? null;
    }
  }

  return selected;
}

function recurrenceEndFromBody(body: IncomeBody, month: number, year: number) {
  const rawMonth = body.recurrenceEndMonth ?? body.recurrence_end_month;
  const rawYear = body.recurrenceEndYear ?? body.recurrence_end_year;
  const endMonth = rawMonth === undefined || rawMonth === null || rawMonth === "" ? undefined : parseMonth(rawMonth);
  const endYear = rawYear === undefined || rawYear === null || rawYear === "" ? undefined : parseYear(rawYear);

  return normalizeIncomeEnd(month, year, endMonth, endYear);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const profileId = parseId(url.searchParams.get("profileId"), "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const month = parseMonth(url.searchParams.get("month"));
      const year = parseYear(url.searchParams.get("year"));
      const income = await env.DB.prepare(
        "SELECT * FROM monthly_income WHERE profile_id = ? AND month = ? AND year = ?",
      )
        .bind(profileId, month, year)
        .first<MonthlyIncomeRow>();

      return json({ income: income ?? null });
    }

    if (request.method === "POST") {
      const body = await readJson<IncomeBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const month = parseMonth(body.month);
      const year = parseYear(body.year);
      const amount = parsePositiveAmount(body.amount, "Valor da renda");
      const notes = optionalText(body.notes);
      const isRecurring = boolToInt(body.is_recurring ?? body.isRecurring) === 1;

      if (isRecurring) {
        const end = recurrenceEndFromBody(body, month, year);
        const income = await upsertIncomeSeries(env.DB, {
          profileId,
          month,
          year,
          amount,
          notes,
          groupId: randomGroupId("income"),
          endMonth: end.month,
          endYear: end.year,
        });

        return json({ income }, 201);
      }

      const income = await env.DB.prepare(
        `INSERT INTO monthly_income (profile_id, month, year, amount, notes, is_recurring, recurrence_group_id, recurrence_start_month, recurrence_start_year, recurrence_end_month, recurrence_end_year)
         VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL)
         ON CONFLICT(profile_id, month, year) DO UPDATE SET
          amount = excluded.amount,
          notes = excluded.notes,
          is_recurring = 0,
          recurrence_group_id = NULL,
          recurrence_start_month = NULL,
          recurrence_start_year = NULL,
          recurrence_end_month = NULL,
          recurrence_end_year = NULL,
          updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
      )
        .bind(profileId, month, year, amount, notes)
        .first<MonthlyIncomeRow>();

      return json({ income }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<IncomeBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM monthly_income WHERE id = ?").bind(id).first<MonthlyIncomeRow>();
      if (!existing) {
        return apiError("Renda não encontrada.", 404);
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      const month = parseMonth(body.month);
      const year = parseYear(body.year);
      const amount = parsePositiveAmount(body.amount, "Valor da renda");
      const notes = optionalText(body.notes);
      const isRecurring = boolToInt(body.is_recurring ?? body.isRecurring) === 1;
      const applyToFuture = body.applyToFuture !== false;

      if (isRecurring) {
        const end = recurrenceEndFromBody(body, month, year);
        const groupId = existing.recurrence_group_id ?? randomGroupId("income");

        if (applyToFuture) {
          await env.DB.prepare(
            "DELETE FROM monthly_income WHERE recurrence_group_id = ? AND ((year * 12) + month) >= ?",
          )
            .bind(groupId, monthKey(month, year))
            .run();

          const income = await upsertIncomeSeries(env.DB, {
            profileId: existing.profile_id,
            month,
            year,
            amount,
            notes,
            groupId,
            endMonth: end.month,
            endYear: end.year,
          });

          return json({ income });
        }
      }

      const income = await env.DB.prepare(
        `UPDATE monthly_income
         SET month = ?, year = ?, amount = ?, notes = ?, is_recurring = ?, recurrence_group_id = ?, recurrence_start_month = ?, recurrence_start_year = ?, recurrence_end_month = ?, recurrence_end_year = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
      )
        .bind(
          month,
          year,
          amount,
          notes,
          isRecurring ? 1 : 0,
          isRecurring ? (existing.recurrence_group_id ?? randomGroupId("income")) : null,
          isRecurring ? month : null,
          isRecurring ? year : null,
          isRecurring ? recurrenceEndFromBody(body, month, year).month : null,
          isRecurring ? recurrenceEndFromBody(body, month, year).year : null,
          id,
        )
        .first<MonthlyIncomeRow>();

      return json({ income });
    }

    if (request.method === "DELETE") {
      const body = await readJson<IncomeBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM monthly_income WHERE id = ?").bind(id).first<MonthlyIncomeRow>();
      if (!existing) {
        return json({ ok: true });
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      if (existing.is_recurring && existing.recurrence_group_id && body.applyToFuture !== false) {
        await env.DB.prepare(
          "DELETE FROM monthly_income WHERE recurrence_group_id = ? AND ((year * 12) + month) >= ?",
        )
          .bind(existing.recurrence_group_id, monthKey(existing.month, existing.year))
          .run();
      } else {
        await env.DB.prepare("DELETE FROM monthly_income WHERE id = ?").bind(id).run();
      }

      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de renda.", 400);
  }
};

