// CS50 Final Project — functions/api/dashboard.ts: Cloudflare Pages API endpoint.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { requireProfileAccess } from "../_shared/auth";
import {
  getDbFeatureFlags,
  effectiveCategorySqlForSchema,
  openFinanceConnectionIdSelectSql,
  openFinanceSystemCategorySelectSql,
} from "../_shared/db-schema";
import { listGoalsWithDetails } from "../_shared/goals";
import { apiError, json, monthRange, parseId, parseMonth, parseYear } from "../_shared/http";
import { openFinanceFlowSql } from "../_shared/openfinance/flow";
import type { CategoryRow, Env } from "../_shared/types";

interface SumRow {
  total: number | null;
}

interface CategoryTotalRow {
  category: string;
  total: number;
}

interface MerchantTotalRow {
  merchant: string;
  total: number;
  count: number;
}

interface SourceTotalRow {
  source_type: string;
  total: number;
}

interface GoalLinkedSpendingRow {
  goal_id: number;
  goal_name: string;
  total: number;
}

interface ProgressionPoint {
  label: string;
  month: number;
  year: number;
  income: number;
  expenses: number;
  balance: number;
}

function money(value: number | null | undefined) {
  return Math.round((value ?? 0) * 100) / 100;
}

function shiftMonth(month: number, year: number, offset: number) {
  const zeroBased = year * 12 + (month - 1) + offset;
  const shiftedYear = Math.floor(zeroBased / 12);
  const shiftedMonth = (zeroBased % 12) + 1;

  return { month: shiftedMonth, year: shiftedYear };
}

function labelMonth(month: number, year: number) {
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function openFinanceFlowSqlForColumns(
  hasSystemCategory: boolean,
  options: { alias?: string; transactionKindSql?: string } = {},
) {
  const prefix = options.alias ? `${options.alias}.` : "";
  return openFinanceFlowSql({
    userCategorySql: `${prefix}user_category`,
    systemCategorySql: hasSystemCategory ? `${prefix}system_category` : null,
    originalCategorySql: `${prefix}original_category`,
    transactionKindSql: options.transactionKindSql ?? `${prefix}transaction_kind`,
  });
}

async function totalIncome(db: D1Database, profileId: number, month: number, year: number) {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM monthly_income WHERE profile_id = ? AND month = ? AND year = ?")
    .bind(profileId, month, year)
    .first<SumRow>();

  return money(row?.total);
}

async function totalManualExpenses(db: D1Database, profileId: number, month: number, year: number) {
  const { start, end } = monthRange(month, year);
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE profile_id = ? AND date >= ? AND date < ?")
    .bind(profileId, start, end)
    .first<SumRow>();

  return money(row?.total);
}

async function totalImportedIncome(
  db: D1Database,
  profileId: number,
  month: number,
  year: number,
  flowSql: string,
) {
  const { start, end } = monthRange(month, year);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) / 100.0 AS total
       FROM open_finance_transactions
       WHERE owner_id = ? AND posted_at >= ? AND posted_at < ? AND ${flowSql} = 'income'`,
    )
    .bind(profileId, start, end)
    .first<SumRow>();

  return money(row?.total);
}

async function totalImportedExpenses(
  db: D1Database,
  profileId: number,
  month: number,
  year: number,
  flowSql: string,
  sourceType?: string,
) {
  const { start, end } = monthRange(month, year);
  const clauses = [
    "owner_id = ?",
    "posted_at >= ?",
    "posted_at < ?",
    `${flowSql} = 'expense'`,
  ];
  const bindings: Array<number | string> = [profileId, start, end];

  if (sourceType) {
    clauses.push("source_type = ?");
    bindings.push(sourceType);
  }

  const row = await db
    .prepare(`SELECT COALESCE(SUM(amount_cents), 0) / 100.0 AS total FROM open_finance_transactions WHERE ${clauses.join(" AND ")}`)
    .bind(...bindings)
    .first<SumRow>();

  return money(row?.total);
}

async function combinedCategoryTotals(
  db: D1Database,
  profileId: number,
  month: number,
  year: number,
  effectiveCategorySql: string,
  flowSql: string,
) {
  const { start, end } = monthRange(month, year);
  const { results = [] } = await db
    .prepare(
      `SELECT category, COALESCE(SUM(total), 0) AS total
       FROM (
         SELECT category, COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE profile_id = ? AND date >= ? AND date < ?
         GROUP BY category

         UNION ALL

         SELECT ${effectiveCategorySql} AS category,
                COALESCE(SUM(amount_cents), 0) / 100.0 AS total
         FROM open_finance_transactions
         WHERE owner_id = ?
           AND posted_at >= ?
           AND posted_at < ?
           AND ${flowSql} = 'expense'
         GROUP BY category
       )
       GROUP BY category
       ORDER BY total DESC`,
    )
    .bind(profileId, start, end, profileId, start, end)
    .all<CategoryTotalRow>();

  return results;
}

async function importedSourceTotals(db: D1Database, profileId: number, month: number, year: number, flowSql: string) {
  const { start, end } = monthRange(month, year);
  const { results = [] } = await db
    .prepare(
      `SELECT source_type, COALESCE(SUM(amount_cents), 0) / 100.0 AS total
       FROM open_finance_transactions
       WHERE owner_id = ?
         AND posted_at >= ?
         AND posted_at < ?
         AND ${flowSql} = 'expense'
       GROUP BY source_type`,
    )
    .bind(profileId, start, end)
    .all<SourceTotalRow>();

  return results;
}

async function topMerchants(db: D1Database, profileId: number, month: number, year: number, flowSql: string) {
  const { start, end } = monthRange(month, year);
  const { results = [] } = await db
    .prepare(
      `SELECT COALESCE(NULLIF(merchant_name, ''), description) AS merchant,
              COALESCE(SUM(amount_cents), 0) / 100.0 AS total,
              COUNT(*) AS count
       FROM open_finance_transactions
       WHERE owner_id = ?
         AND posted_at >= ?
         AND posted_at < ?
         AND ${flowSql} = 'expense'
       GROUP BY merchant
       ORDER BY total DESC
       LIMIT 8`,
    )
    .bind(profileId, start, end)
    .all<MerchantTotalRow>();

  return results;
}

async function monthlyGoalLinkedSpending(
  db: D1Database,
  profileId: number,
  month: number,
  year: number,
  hasGoalTransactionLinks: boolean,
  hasSystemCategory: boolean,
) {
  if (!hasGoalTransactionLinks) {
    return [];
  }

  const { start, end } = monthRange(month, year);
  const flowSql = openFinanceFlowSqlForColumns(hasSystemCategory, { alias: "oft" });
  const { results = [] } = await db
    .prepare(
      `SELECT
         sg.id AS goal_id,
         sg.name AS goal_name,
         COALESCE(SUM(oft.amount_cents), 0) / 100.0 AS total
       FROM goal_transaction_links gtl
       JOIN savings_goals sg ON sg.id = gtl.goal_id
       JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
       WHERE gtl.profile_id = ?
         AND oft.posted_at >= ?
         AND oft.posted_at < ?
         AND ${flowSql} = 'expense'
       GROUP BY sg.id, sg.name
       ORDER BY total DESC`,
    )
    .bind(profileId, start, end)
    .all<GoalLinkedSpendingRow>();

  return results;
}

function insightText(categoryTotals: CategoryTotalRow[], previousCategoryTotals: CategoryTotalRow[], merchants: MerchantTotalRow[]) {
  const totalExpenses = categoryTotals.reduce((sum, row) => sum + row.total, 0);
  if (totalExpenses <= 0) {
    return [];
  }

  const insights: Array<{ title: string; detail: string; amount: number }> = [];
  const topCategory = categoryTotals[0];
  if (topCategory) {
    const percentage = Math.round((topCategory.total / totalExpenses) * 100);
    insights.push({
      title: "Maior categoria do mês",
      detail: `Seu maior gasto no período foi ${topCategory.category}, representando ${percentage}% das despesas.`,
      amount: money(topCategory.total),
    });
  }

  const previous = new Map(previousCategoryTotals.map((row) => [row.category, row.total]));
  const increased = categoryTotals
    .map((row) => ({ ...row, increase: row.total - (previous.get(row.category) ?? 0) }))
    .filter((row) => row.increase > 50)
    .sort((left, right) => right.increase - left.increase)[0];

  if (increased) {
    insights.push({
      title: "Categoria em alta",
      detail: `${increased.category} aumentou em relação ao mês anterior.`,
      amount: money(increased.increase),
    });
  }

  const repeated = merchants.filter((merchant) => merchant.count >= 3 && merchant.total >= 30).sort((left, right) => right.count - left.count)[0];
  if (repeated) {
    insights.push({
      title: "Compras recorrentes",
      detail: `Pequenas compras recorrentes em ${repeated.merchant} somaram ${money(repeated.total).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} no mês.`,
      amount: money(repeated.total),
    });
  }

  return insights.slice(0, 4);
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const profileId = parseId(url.searchParams.get("profileId"), "profileId");
    const auth = await requireProfileAccess(request, env, profileId);
    if (auth) {
      return auth;
    }
    const schema = await getDbFeatureFlags(env.DB);
    const effectiveCategorySql = effectiveCategorySqlForSchema(schema);
    const flowSql = openFinanceFlowSqlForColumns(schema.hasSystemCategory);

    const month = parseMonth(url.searchParams.get("month"));
    const year = parseYear(url.searchParams.get("year"));
    const { start, end } = monthRange(month, year);

    const manualIncome = await totalIncome(env.DB, profileId, month, year);
    const importedIncome = await totalImportedIncome(env.DB, profileId, month, year, flowSql);
    const income = money(manualIncome + importedIncome);
    const manualExpenses = await totalManualExpenses(env.DB, profileId, month, year);
    const importedExpenses = await totalImportedExpenses(env.DB, profileId, month, year, flowSql);
    const expenses = money(manualExpenses + importedExpenses);
    const bankAccountExpenses = await totalImportedExpenses(env.DB, profileId, month, year, flowSql, "bank_account");
    const creditCardExpenses = await totalImportedExpenses(env.DB, profileId, month, year, flowSql, "credit_card");
    const remainingBalance = money(income - expenses);
    const incomeSpentPercentage = income > 0 ? Math.round((expenses / income) * 10000) / 100 : 0;

    const reserveRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM reserve_entries WHERE profile_id = ?",
    )
      .bind(profileId)
      .first<SumRow>();
    const totalStoredMoney = money(reserveRow?.total);

    const goals = await listGoalsWithDetails(env.DB, profileId);
    const totalGoalTargetAmount = money(goals.reduce((total, goal) => total + goal.target_amount, 0));
    const totalCurrentSavingsTowardGoals = money(goals.reduce((total, goal) => total + goal.current_amount, 0));
    const savingsProgressPercentage =
      totalGoalTargetAmount > 0
        ? Math.min(100, Math.round((totalCurrentSavingsTowardGoals / totalGoalTargetAmount) * 10000) / 100)
        : 0;

    const categoryTotals = await combinedCategoryTotals(env.DB, profileId, month, year, effectiveCategorySql, flowSql);
    const previousMonth = shiftMonth(month, year, -1);
    const previousCategoryTotals = await combinedCategoryTotals(
      env.DB,
      profileId,
      previousMonth.month,
      previousMonth.year,
      effectiveCategorySql,
      flowSql,
    );
    const { results: categories = [] } = await env.DB.prepare(
      "SELECT * FROM categories WHERE profile_id IS NULL OR profile_id = ?",
    )
      .bind(profileId)
      .all<CategoryRow>();
    const categoryColors = new Map(categories.map((category) => [category.name, category.color]));

    const categoryMonthComparison = categoryTotals.map((row) => {
      const previousTotal = previousCategoryTotals.find((previous) => previous.category === row.category)?.total ?? 0;
      return {
        category: row.category,
        currentTotal: money(row.total),
        previousTotal: money(previousTotal),
        difference: money(row.total - previousTotal),
        color: categoryColors.get(row.category) ?? "#94a3b8",
      };
    });

    const topIncreasingCategories = [...categoryMonthComparison]
      .filter((item) => item.difference > 0)
      .sort((left, right) => right.difference - left.difference)
      .slice(0, 5);

    const progression: ProgressionPoint[] = [];
    for (let offset = -5; offset <= 0; offset += 1) {
      const point = shiftMonth(month, year, offset);
      const pointIncome = money(
        (await totalIncome(env.DB, profileId, point.month, point.year)) +
          (await totalImportedIncome(env.DB, profileId, point.month, point.year, flowSql)),
      );
      const pointExpenses = money(
        (await totalManualExpenses(env.DB, profileId, point.month, point.year)) +
          (await totalImportedExpenses(env.DB, profileId, point.month, point.year, flowSql)),
      );
      progression.push({
        label: labelMonth(point.month, point.year),
        month: point.month,
        year: point.year,
        income: pointIncome,
        expenses: pointExpenses,
        balance: money(pointIncome - pointExpenses),
      });
    }

    const sourceTotals = await importedSourceTotals(env.DB, profileId, month, year, flowSql);
    const merchantTotals = await topMerchants(env.DB, profileId, month, year, flowSql);
    const recurringMerchants = merchantTotals
      .filter((merchant) => merchant.count >= 2)
      .sort((left, right) => right.count - left.count || right.total - left.total)
      .slice(0, 5)
      .map((merchant) => ({
        merchant: merchant.merchant,
        total: money(merchant.total),
        count: merchant.count,
      }));

    const goalLinkedSpending = (
      await monthlyGoalLinkedSpending(env.DB, profileId, month, year, schema.hasGoalTransactionLinks, schema.hasSystemCategory)
    ).map((row) => ({
      goalId: row.goal_id,
      goalName: row.goal_name,
      total: money(row.total),
    }));

    const { results: recentTransactions = [] } = await env.DB.prepare(
      `SELECT
         id, owner_id, ${openFinanceConnectionIdSelectSql(schema)}, source, source_type, source_account_id, source_bill_id, external_id, dedupe_key,
         transaction_kind, amount_cents, currency, description, merchant_name, original_category, ${openFinanceSystemCategorySelectSql(schema)}, user_category,
         posted_at, created_at, updated_at,
         ${effectiveCategorySql} AS effective_category,
         ${flowSql} AS flow_type,
         ROUND(amount_cents / 100.0, 2) AS amount
       FROM open_finance_transactions
       WHERE owner_id = ? AND posted_at >= ? AND posted_at < ?
       ORDER BY posted_at DESC, id DESC
       LIMIT 8`,
    )
      .bind(profileId, start, end)
      .all();

    const uncategorizedRow = await env.DB.prepare(
       `SELECT COUNT(*) AS total
        FROM open_finance_transactions
        WHERE owner_id = ?
          AND posted_at >= ?
          AND posted_at < ?
          AND ${flowSql} = 'expense'
          AND TRIM(COALESCE(user_category, '')) = ''
          ${schema.hasSystemCategory ? "AND TRIM(COALESCE(system_category, '')) = ''" : ""}
          AND TRIM(COALESCE(original_category, '')) = ''`,
    )
      .bind(profileId, start, end)
      .first<{ total: number }>();

    const budgetAlerts: Array<{ id: string; title: string; detail: string; amount: number; severity: string }> = [];
    for (const goal of goals) {
      if (goal.status === "active" && goal.monthly_savings_needed >= 500) {
        budgetAlerts.push({
          id: `goal-monthly-${goal.id}`,
          title: `${goal.name} exige aporte forte`,
          detail: `Para bater a meta no prazo atual, o aporte mensal estimado está alto.`,
          amount: money(goal.monthly_savings_needed),
          severity: "warning",
        });
      }

      if (goal.planned_budget_total > 0 && goal.actual_budget_total > goal.planned_budget_total) {
        budgetAlerts.push({
          id: `goal-budget-${goal.id}`,
          title: `${goal.name} passou do orçamento`,
          detail: `Os gastos vinculados já superaram o total planejado para esse objetivo.`,
          amount: money(goal.actual_budget_total - goal.planned_budget_total),
          severity: "critical",
        });
      }
    }

    const importantActions: Array<{ id: string; title: string; detail: string; amount: number; severity: string }> = [];
    const uncategorizedCount = uncategorizedRow?.total ?? 0;
    if (uncategorizedCount > 0) {
      importantActions.push({
        id: "uncategorized",
        title: `${uncategorizedCount} transações sem categoria`,
        detail: "Vale revisar ou reprocessar para melhorar as análises do mês.",
        amount: uncategorizedCount,
        severity: uncategorizedCount >= 10 ? "critical" : "warning",
      });
    }

    const highestMonthlyNeed = goals
      .filter((goal) => goal.status === "active" && goal.monthly_savings_needed > 0)
      .sort((left, right) => right.monthly_savings_needed - left.monthly_savings_needed)[0];
    if (highestMonthlyNeed) {
      importantActions.push({
        id: `goal-need-${highestMonthlyNeed.id}`,
        title: `${highestMonthlyNeed.name} precisa de ${highestMonthlyNeed.monthly_savings_needed.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}/mês`,
        detail: "Esse é o objetivo ativo que mais exige caixa por mês hoje.",
        amount: money(highestMonthlyNeed.monthly_savings_needed),
        severity: highestMonthlyNeed.monthly_savings_needed >= 500 ? "warning" : "info",
      });
    }

    const biggestIncrease = topIncreasingCategories[0];
    if (biggestIncrease && biggestIncrease.difference > 0) {
      importantActions.push({
        id: `increase-${biggestIncrease.category}`,
        title: `${biggestIncrease.category} subiu ${biggestIncrease.difference.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`,
        detail: "Comparação direta com o mês anterior para a mesma categoria.",
        amount: money(biggestIncrease.difference),
        severity: biggestIncrease.difference >= 200 ? "warning" : "info",
      });
    }

    const deliverySpend = categoryTotals.find((row) => row.category === "Delivery");
    if (deliverySpend && deliverySpend.total > 0) {
      importantActions.push({
        id: "delivery",
        title: `Delivery somou ${deliverySpend.total.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}`,
        detail: "Categoria sensível para revisar rápido no celular.",
        amount: money(deliverySpend.total),
        severity: deliverySpend.total >= 300 ? "warning" : "info",
      });
    }

    const totalGoalLinkedSpending = goalLinkedSpending.reduce((sum, item) => sum + item.total, 0);
    if (totalGoalLinkedSpending > 0) {
      importantActions.push({
        id: "linked-goals",
        title: `Você gastou ${totalGoalLinkedSpending.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} vinculados a objetivos`,
        detail: "Isso ajuda a separar gastos planejados do resto do consumo.",
        amount: money(totalGoalLinkedSpending),
        severity: "info",
      });
    }

    return json({
      summary: {
        monthlyIncome: income,
        totalMonthlyExpenses: expenses,
        remainingBalance,
        incomeSpentPercentage,
        manualIncome,
        importedIncome,
        manualExpenses,
        importedExpenses,
        bankAccountExpenses,
        creditCardExpenses,
        totalStoredMoney,
        totalSavingsGoalTargetAmount: totalGoalTargetAmount,
        totalCurrentSavingsTowardGoals,
        savingsProgressPercentage,
        expensesByCategory: categoryTotals.map((row) => ({
          category: row.category,
          total: money(row.total),
          color: categoryColors.get(row.category) ?? "#94a3b8",
        })),
        monthlyBalanceProgression: progression,
        goals,
        importedExpensesBySource: sourceTotals.map((row) => ({
          sourceType: row.source_type,
          total: money(row.total),
        })),
        topMerchants: merchantTotals.map((row) => ({
          merchant: row.merchant,
          total: money(row.total),
          count: row.count,
        })),
        recurringMerchants,
        recentTransactions,
        uncategorizedTransactionsCount: uncategorizedCount,
        savingsInsights: insightText(categoryTotals, previousCategoryTotals, merchantTotals),
        categoryMonthComparison,
        topIncreasingCategories,
        goalLinkedSpending,
        budgetAlerts: budgetAlerts.slice(0, 6),
        importantActions: importantActions.slice(0, 6),
      },
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Falha na requisição do resumo.", 400);
  }
};
