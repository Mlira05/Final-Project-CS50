// CS50 Final Project — functions/api/expenses.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import {
  apiError,
  boolToInt,
  json,
  methodNotAllowed,
  monthRange,
  optionalText,
  parseDate,
  parseId,
  parseMonth,
  parsePositiveAmount,
  parseYear,
  readJson,
  requiredText,
} from "../_shared/http";
import { defaultEndOfYearDate, listMonthlyDates, randomGroupId } from "../_shared/recurrence";
import type { Env, ExpenseRow } from "../_shared/types";

interface ExpenseBody {
  id?: unknown;
  profile_id?: unknown;
  profileId?: unknown;
  name?: unknown;
  category?: unknown;
  amount?: unknown;
  date?: unknown;
  payment_method?: unknown;
  paymentMethod?: unknown;
  is_recurring?: unknown;
  isRecurring?: unknown;
  recurrenceEndDate?: unknown;
  recurrence_end_date?: unknown;
  applyToFuture?: unknown;
  notes?: unknown;
}

interface ExpenseSeriesParams {
  profileId: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes: string | null;
  groupId: string;
  endDate: string;
}

async function insertExpenseSeries(db: D1Database, params: ExpenseSeriesParams) {
  let selected: ExpenseRow | null = null;
  const dates = listMonthlyDates(params.date, params.endDate);

  for (const date of dates) {
    const row = await db.prepare(
      `INSERT INTO expenses
        (profile_id, name, category, amount, date, payment_method, is_recurring, recurrence_group_id, recurrence_start_date, recurrence_end_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
       RETURNING *`,
    )
      .bind(
        params.profileId,
        params.name,
        params.category,
        params.amount,
        date,
        params.paymentMethod,
        params.groupId,
        params.date,
        params.endDate,
        params.notes,
      )
      .first<ExpenseRow>();

    if (date === params.date) {
      selected = row ?? null;
    }
  }

  return selected;
}

function recurrenceEndDateFromBody(body: ExpenseBody, date: string) {
  const rawEnd = body.recurrenceEndDate ?? body.recurrence_end_date;
  return rawEnd ? parseDate(rawEnd, "Data final da recorrência") : defaultEndOfYearDate(date);
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
      const category = url.searchParams.get("category");
      const paymentMethod = url.searchParams.get("paymentMethod");
      const { start, end } = monthRange(month, year);
      const clauses = ["profile_id = ?", "date >= ?", "date < ?"];
      const bindings: (number | string)[] = [profileId, start, end];

      if (category && category !== "all") {
        clauses.push("category = ?");
        bindings.push(category);
      }

      if (paymentMethod && paymentMethod !== "all") {
        clauses.push("payment_method = ?");
        bindings.push(paymentMethod);
      }

      const { results } = await env.DB.prepare(
        `SELECT * FROM expenses WHERE ${clauses.join(" AND ")} ORDER BY date DESC, created_at DESC`,
      )
        .bind(...bindings)
        .all<ExpenseRow>();

      return json({ expenses: results ?? [] });
    }

    if (request.method === "POST") {
      const body = await readJson<ExpenseBody>(request);
      const profileId = parseId(body.profile_id ?? body.profileId, "profileId");
      const auth = await requireProfileAccess(request, env, profileId);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name, "Nome da despesa");
      const category = requiredText(body.category, "Categoria");
      const amount = parsePositiveAmount(body.amount, "Valor da despesa");
      const date = parseDate(body.date, "Data da despesa");
      const paymentMethod = requiredText(body.payment_method ?? body.paymentMethod, "Forma de pagamento");
      const isRecurring = boolToInt(body.is_recurring ?? body.isRecurring) === 1;
      const notes = optionalText(body.notes);

      if (isRecurring) {
        const expense = await insertExpenseSeries(env.DB, {
          profileId,
          name,
          category,
          amount,
          date,
          paymentMethod,
          notes,
          groupId: randomGroupId("expense"),
          endDate: recurrenceEndDateFromBody(body, date),
        });

        return json({ expense }, 201);
      }

      const expense = await env.DB.prepare(
        `INSERT INTO expenses
          (profile_id, name, category, amount, date, payment_method, is_recurring, recurrence_group_id, recurrence_start_date, recurrence_end_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?)
         RETURNING *`,
      )
        .bind(profileId, name, category, amount, date, paymentMethod, notes)
        .first<ExpenseRow>();

      return json({ expense }, 201);
    }

    if (request.method === "PUT") {
      const body = await readJson<ExpenseBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first<ExpenseRow>();
      if (!existing) {
        return apiError("Despesa não encontrada.", 404);
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      const name = requiredText(body.name, "Nome da despesa");
      const category = requiredText(body.category, "Categoria");
      const amount = parsePositiveAmount(body.amount, "Valor da despesa");
      const date = parseDate(body.date, "Data da despesa");
      const paymentMethod = requiredText(body.payment_method ?? body.paymentMethod, "Forma de pagamento");
      const isRecurring = boolToInt(body.is_recurring ?? body.isRecurring) === 1;
      const notes = optionalText(body.notes);
      const applyToFuture = body.applyToFuture !== false;

      if (isRecurring && applyToFuture) {
        const groupId = existing.recurrence_group_id ?? randomGroupId("expense");
        await env.DB.prepare("DELETE FROM expenses WHERE recurrence_group_id = ? AND date >= ?")
          .bind(groupId, existing.date)
          .run();

        const expense = await insertExpenseSeries(env.DB, {
          profileId: existing.profile_id,
          name,
          category,
          amount,
          date,
          paymentMethod,
          notes,
          groupId,
          endDate: recurrenceEndDateFromBody(body, date),
        });

        return json({ expense });
      }

      const endDate = isRecurring ? recurrenceEndDateFromBody(body, date) : null;
      const expense = await env.DB.prepare(
        `UPDATE expenses
         SET name = ?, category = ?, amount = ?, date = ?, payment_method = ?, is_recurring = ?, recurrence_group_id = ?, recurrence_start_date = ?, recurrence_end_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
         RETURNING *`,
      )
        .bind(
          name,
          category,
          amount,
          date,
          paymentMethod,
          isRecurring ? 1 : 0,
          isRecurring ? (existing.recurrence_group_id ?? randomGroupId("expense")) : null,
          isRecurring ? date : null,
          endDate,
          notes,
          id,
        )
        .first<ExpenseRow>();

      return json({ expense });
    }

    if (request.method === "DELETE") {
      const body = await readJson<ExpenseBody>(request);
      const id = parseId(body.id);
      const existing = await env.DB.prepare("SELECT * FROM expenses WHERE id = ?").bind(id).first<ExpenseRow>();
      if (!existing) {
        return json({ ok: true });
      }

      const auth = await requireProfileAccess(request, env, existing.profile_id);
      if (auth) {
        return auth;
      }

      if (existing.is_recurring && existing.recurrence_group_id && body.applyToFuture !== false) {
        await env.DB.prepare("DELETE FROM expenses WHERE recurrence_group_id = ? AND date >= ?")
          .bind(existing.recurrence_group_id, existing.date)
          .run();
      } else {
        await env.DB.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
      }

      return json({ ok: true });
    }

    return methodNotAllowed();
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição de despesas.", 400);
  }
};

