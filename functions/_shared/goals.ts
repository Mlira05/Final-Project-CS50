// CS50 Final Project — functions/_shared/goals.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import {
  effectiveCategorySqlForSchema,
  getDbFeatureFlags,
  savingsGoalsOrderBySql,
  savingsGoalsSelectSql,
} from "./db-schema";
import { openFinanceFlowSql } from "./openfinance/flow";
import type {
  GoalBudgetAllocationRow,
  GoalBudgetItemRow,
  GoalContributionRow,
  GoalParticipantRow,
  GoalTransactionLinkRow,
  PublicProfileRow,
  SavingsGoalRow,
} from "./types";

export interface SavingsGoalWithProgress extends SavingsGoalRow {
  remaining_amount: number;
  progress_percentage: number;
  months_left: number;
  monthly_savings_needed: number;
}

export interface GoalBudgetItemWithProgress extends GoalBudgetItemRow {
  remaining_amount: number;
  progress_percentage: number;
  spent_percentage: number;
  allocation_percentage: number;
  spent_remaining_amount: number;
}

export interface GoalLinkedTransaction extends GoalTransactionLinkRow {
  budget_item_name: string | null;
  transaction_amount: number;
  transaction_posted_at: string;
  transaction_description: string;
  transaction_merchant_name: string | null;
  transaction_kind: string;
  transaction_effective_category: string;
  transaction_source_type: string;
}

export interface SavingsGoalWithDetails extends SavingsGoalWithProgress {
  planned_budget_total: number;
  allocated_budget_total: number;
  actual_budget_total: number;
  budget_remaining_total: number;
  linked_spending_total: number;
  contribution_count: number;
  participants: GoalParticipantWithProfile[];
  contributions_by_profile: Array<{
    profile_id: number;
    profile_name: string;
    total: number;
  }>;
  latest_contributions: GoalContributionRow[];
  budget_items: GoalBudgetItemWithProgress[];
  linked_transactions: GoalLinkedTransaction[];
  recent_allocations: GoalBudgetAllocationWithDetails[];
}

interface GoalLinkedTransactionRow extends GoalTransactionLinkRow {
  budget_item_name: string | null;
  transaction_amount: number | null;
  transaction_posted_at: string | null;
  transaction_description: string | null;
  transaction_merchant_name: string | null;
  transaction_kind: string | null;
  transaction_effective_category: string | null;
  transaction_source_type: string | null;
}

export interface GoalParticipantWithProfile extends GoalParticipantRow {
  profile_name: string;
}

export interface GoalBudgetAllocationWithDetails extends GoalBudgetAllocationRow {
  budget_item_name: string;
  profile_name: string;
  source_label: string | null;
}

export type AllocationStrategy = "largest_first" | "smallest_first" | "manual_order";

export interface GoalAllocationResult {
  allocatedTotal: number;
  unallocatedAmount: number;
  allocations: Array<{
    budgetItemId: number;
    amount: number;
  }>;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function targetDateOf(goal: Pick<SavingsGoalRow, "target_date" | "deadline">) {
  return goal.target_date?.trim() || goal.deadline;
}

function monthsUntil(deadline: string) {
  const today = new Date();
  const target = new Date(`${deadline}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  const monthDelta =
    (target.getFullYear() - today.getFullYear()) * 12 + target.getMonth() - today.getMonth();
  const inclusiveAdjustment = target.getDate() >= today.getDate() ? 1 : 0;

  return Math.max(0, monthDelta + inclusiveAdjustment);
}

export function withGoalCalculations(goal: SavingsGoalRow): SavingsGoalWithProgress {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const monthsLeft = monthsUntil(targetDateOf(goal));
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;

  return {
    ...goal,
    target_date: targetDateOf(goal),
    remaining_amount: Math.round(remaining * 100) / 100,
    progress_percentage: Math.min(100, Math.round(progress * 100) / 100),
    months_left: monthsLeft,
    monthly_savings_needed:
      monthsLeft > 0 ? Math.round((remaining / monthsLeft) * 100) / 100 : remaining,
  };
}

export function withBudgetItemCalculations(item: GoalBudgetItemRow): GoalBudgetItemWithProgress {
  const allocatedAmount = item.allocated_amount ?? 0;
  const actualAmount = item.actual_amount ?? 0;
  const remaining = Math.max(0, item.planned_amount - allocatedAmount);
  const spentRemaining = Math.max(0, item.planned_amount - actualAmount);
  const allocationProgress =
    item.planned_amount > 0 ? Math.min(100, (allocatedAmount / item.planned_amount) * 100) : 0;
  const spentProgress =
    item.planned_amount > 0 ? Math.min(100, (actualAmount / item.planned_amount) * 100) : 0;

  return {
    ...item,
    allocated_amount: roundMoney(allocatedAmount),
    actual_amount: roundMoney(actualAmount),
    remaining_amount: roundMoney(remaining),
    spent_remaining_amount: roundMoney(spentRemaining),
    allocation_percentage: roundMoney(allocationProgress),
    spent_percentage: roundMoney(spentProgress),
    progress_percentage: roundMoney(Math.max(allocationProgress, spentProgress)),
  };
}

export async function ensureGoalParticipants(
  db: D1Database,
  goalId: number,
  ownerProfileId: number,
  ownerMode: string,
  participantIds?: number[],
) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalParticipants) {
    return;
  }

  const targetIds = new Set<number>([ownerProfileId]);
  if (ownerMode === "shared") {
    if (participantIds?.length) {
      for (const id of participantIds) {
        targetIds.add(id);
      }
    } else {
      const { results = [] } = await db.prepare("SELECT id FROM profiles ORDER BY id ASC").all<{ id: number }>();
      for (const profile of results) {
        targetIds.add(profile.id);
      }
    }
  }

  await db.prepare("DELETE FROM goal_participants WHERE goal_id = ?").bind(goalId).run();
  for (const profileId of targetIds) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO goal_participants (goal_id, profile_id, role)
         VALUES (?, ?, ?)`,
      )
      .bind(goalId, profileId, profileId === ownerProfileId ? "owner" : "participant")
      .run();
  }
}

export async function refreshGoalBudgetItemRollups(db: D1Database, goalId: number) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalBudgetItems || !flags.hasGoalBudgetAllocations) {
    return;
  }

  if (flags.hasGoalBudgetItemAllocatedAmount) {
    await db
      .prepare(
        `UPDATE goal_budget_items
         SET allocated_amount = COALESCE(
               (
                 SELECT SUM(amount)
                 FROM goal_budget_allocations gba
                 WHERE gba.budget_item_id = goal_budget_items.id
                   AND gba.source_type IN ('contribution', 'manual')
               ),
               0
             ),
             actual_amount = COALESCE(
               (
                 SELECT SUM(amount)
                 FROM goal_budget_allocations gba
                 WHERE gba.budget_item_id = goal_budget_items.id
                   AND gba.source_type = 'transaction'
               ),
               0
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE goal_id = ?`,
      )
      .bind(goalId)
      .run();
  }
}

async function ensureExcessBudgetItem(db: D1Database, goal: SavingsGoalRow) {
  const existing = await db
    .prepare("SELECT * FROM goal_budget_items WHERE goal_id = ? AND name = 'Excedente' LIMIT 1")
    .bind(goal.id)
    .first<GoalBudgetItemRow>();
  if (existing) {
    return existing;
  }

  return db
    .prepare(
      `INSERT INTO goal_budget_items
        (goal_id, profile_id, name, category, planned_amount, actual_amount, allocated_amount, allocation_order, allocation_strategy, notes)
       VALUES (?, ?, 'Excedente', 'Excedente', 0, 0, 0, 9999, 'priority_order', 'Criado automaticamente para valores acima do orçamento.')
       RETURNING *`,
    )
    .bind(goal.id, goal.profile_id)
    .first<GoalBudgetItemRow>();
}

export async function allocateAmountAcrossGoalBudgetItems(
  db: D1Database,
  input: {
    goalId: number;
    profileId: number;
    amount: number;
    sourceType: "contribution" | "transaction" | "manual";
    sourceId?: number | null;
    strategy?: AllocationStrategy;
    notes?: string | null;
  },
): Promise<GoalAllocationResult> {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalBudgetItems || !flags.hasGoalBudgetAllocations || input.amount <= 0) {
    return { allocatedTotal: 0, unallocatedAmount: roundMoney(input.amount), allocations: [] };
  }

  const goal = await db.prepare("SELECT * FROM savings_goals WHERE id = ?").bind(input.goalId).first<SavingsGoalRow>();
  if (!goal) {
    return { allocatedTotal: 0, unallocatedAmount: roundMoney(input.amount), allocations: [] };
  }

  const orderBy =
    input.strategy === "smallest_first"
      ? "planned_amount ASC, allocation_order ASC, id ASC"
      : input.strategy === "manual_order"
        ? "allocation_order ASC, id ASC"
        : "planned_amount DESC, allocation_order ASC, id ASC";

  const { results = [] } = await db
    .prepare(
      `SELECT *
       FROM goal_budget_items
       WHERE goal_id = ?
         AND name <> 'Excedente'
       ORDER BY ${orderBy}`,
    )
    .bind(input.goalId)
    .all<GoalBudgetItemRow>();

  let remaining = roundMoney(input.amount);
  const allocations: GoalAllocationResult["allocations"] = [];
  const balanceColumn = input.sourceType === "transaction" ? "actual_amount" : "allocated_amount";

  for (const item of results) {
    if (remaining <= 0) {
      break;
    }

    const current = Number(item[balanceColumn] ?? 0);
    const itemRemaining = Math.max(0, item.planned_amount - current);
    if (itemRemaining <= 0) {
      continue;
    }

    const amount = roundMoney(Math.min(remaining, itemRemaining));
    if (amount <= 0) {
      continue;
    }

    await db
      .prepare(
        `INSERT INTO goal_budget_allocations
          (goal_id, budget_item_id, profile_id, source_type, source_id, amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.goalId, item.id, input.profileId, input.sourceType, input.sourceId ?? null, amount, input.notes ?? null)
      .run();
    allocations.push({ budgetItemId: item.id, amount });
    remaining = roundMoney(remaining - amount);
  }

  if (remaining > 0) {
    const excess = await ensureExcessBudgetItem(db, goal);
    if (excess) {
      await db
        .prepare(
          `INSERT INTO goal_budget_allocations
            (goal_id, budget_item_id, profile_id, source_type, source_id, amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(input.goalId, excess.id, input.profileId, input.sourceType, input.sourceId ?? null, remaining, input.notes ?? "Excedente")
        .run();
      allocations.push({ budgetItemId: excess.id, amount: remaining });
      remaining = 0;
    }
  }

  await refreshGoalBudgetItemRollups(db, input.goalId);

  const allocatedTotal = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.amount, 0));
  return {
    allocatedTotal,
    unallocatedAmount: roundMoney(remaining),
    allocations,
  };
}

export async function refreshGoalBudgetItemActuals(db: D1Database, goalId: number) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalBudgetItems || !flags.hasGoalTransactionLinks) {
    return;
  }

  const flowSql = openFinanceFlowSql({
    userCategorySql: "oft.user_category",
    systemCategorySql: flags.hasSystemCategory ? "oft.system_category" : null,
    originalCategorySql: "oft.original_category",
    transactionKindSql: "oft.transaction_kind",
  });

  await db
    .prepare(
      `UPDATE goal_budget_items
       SET actual_amount = COALESCE(
         (
           SELECT COALESCE(SUM(oft.amount_cents), 0) / 100.0
           FROM goal_transaction_links gtl
           JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
           WHERE gtl.budget_item_id = goal_budget_items.id
             AND ${flowSql} = 'expense'
         ),
         0
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE goal_id = ?`,
    )
    .bind(goalId)
    .run();
}

export async function refreshBudgetItemActualAmount(db: D1Database, budgetItemId: number) {
  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalBudgetItems || !flags.hasGoalTransactionLinks) {
    return;
  }

  const flowSql = openFinanceFlowSql({
    userCategorySql: "oft.user_category",
    systemCategorySql: flags.hasSystemCategory ? "oft.system_category" : null,
    originalCategorySql: "oft.original_category",
    transactionKindSql: "oft.transaction_kind",
  });

  await db
    .prepare(
      `UPDATE goal_budget_items
       SET actual_amount = COALESCE(
         (
           SELECT COALESCE(SUM(oft.amount_cents), 0) / 100.0
           FROM goal_transaction_links gtl
           JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
           WHERE gtl.budget_item_id = goal_budget_items.id
             AND ${flowSql} = 'expense'
         ),
         0
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(budgetItemId)
    .run();
}

export async function refreshBudgetItemsLinkedToTransactions(db: D1Database, transactionIds: number[]) {
  if (!transactionIds.length) {
    return;
  }

  const flags = await getDbFeatureFlags(db);
  if (!flags.hasGoalBudgetItems || !flags.hasGoalTransactionLinks) {
    return;
  }

  const placeholders = transactionIds.map(() => "?").join(", ");
  const { results = [] } = await db
    .prepare(
      `SELECT DISTINCT budget_item_id
       FROM goal_transaction_links
       WHERE budget_item_id IS NOT NULL
         AND transaction_id IN (${placeholders})`,
    )
    .bind(...transactionIds)
    .all<{ budget_item_id: number | null }>();

  for (const row of results) {
    if (row.budget_item_id) {
      await refreshBudgetItemActualAmount(db, row.budget_item_id);
    }
  }
}

export async function listGoalsWithDetails(db: D1Database, profileId: number): Promise<SavingsGoalWithDetails[]> {
  const flags = await getDbFeatureFlags(db);
  const goalsQuery = flags.hasGoalParticipants
    ? `SELECT ${savingsGoalsSelectSql(flags)}
       FROM savings_goals
       WHERE profile_id = ?
          OR EXISTS (
            SELECT 1
            FROM goal_participants gp
            WHERE gp.goal_id = savings_goals.id
              AND gp.profile_id = ?
          )
       ORDER BY ${savingsGoalsOrderBySql(flags)}`
    : `SELECT ${savingsGoalsSelectSql(flags)}
       FROM savings_goals
       WHERE profile_id = ?
       ORDER BY ${savingsGoalsOrderBySql(flags)}`;

  const { results: goals = [] } = flags.hasGoalParticipants
    ? await db.prepare(goalsQuery).bind(profileId, profileId).all<SavingsGoalRow>()
    : await db.prepare(goalsQuery).bind(profileId).all<SavingsGoalRow>();

  if (!goals.length) {
    return [];
  }

  const goalIds = goals.map((goal) => goal.id);
  const goalPlaceholders = goalIds.map(() => "?").join(", ");
  for (const goal of goals) {
    await refreshGoalBudgetItemRollups(db, goal.id);
  }

  const contributions = flags.hasGoalContributions
    ? (
        await db
          .prepare(
            `SELECT *
             FROM goal_contributions
             WHERE goal_id IN (${goalPlaceholders})
             ORDER BY contribution_date DESC, created_at DESC`,
          )
          .bind(...goalIds)
          .all<GoalContributionRow>()
      ).results ?? []
    : [];

  const budgetItems = flags.hasGoalBudgetItems
    ? (
        await db
          .prepare(
            `SELECT id,
                    goal_id,
                    profile_id,
                    name,
                    category,
                    planned_amount,
                    ${flags.hasGoalBudgetItemAllocatedAmount ? "allocated_amount" : "0 AS allocated_amount"},
                    actual_amount,
                    ${flags.hasGoalBudgetItemAllocationOrder ? "allocation_order" : "100 AS allocation_order"},
                    ${flags.hasGoalBudgetItemAllocationOrder ? "allocation_strategy" : "'priority_order' AS allocation_strategy"},
                    notes,
                    created_at,
                    updated_at
             FROM goal_budget_items
             WHERE goal_id IN (${goalPlaceholders})
             ORDER BY allocation_order ASC, created_at ASC, id ASC`,
          )
          .bind(...goalIds)
          .all<GoalBudgetItemRow>()
      ).results ?? []
    : [];

  const participants = flags.hasGoalParticipants
    ? (
        await db
          .prepare(
            `SELECT gp.*, p.name AS profile_name
             FROM goal_participants gp
             JOIN profiles p ON p.id = gp.profile_id
             WHERE gp.goal_id IN (${goalPlaceholders})
             ORDER BY gp.role = 'owner' DESC, p.id ASC`,
          )
          .bind(...goalIds)
          .all<GoalParticipantWithProfile>()
      ).results ?? []
    : [];

  const profiles = (
    await db.prepare("SELECT id, name, created_at, updated_at FROM profiles ORDER BY id ASC").all<PublicProfileRow>()
  ).results ?? [];
  const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.name]));

  const allocations = flags.hasGoalBudgetAllocations
    ? (
        await db
          .prepare(
            `SELECT gba.*,
                    gbi.name AS budget_item_name,
                    p.name AS profile_name,
                    COALESCE(gc.source, oft.merchant_name, oft.description, gba.notes) AS source_label
             FROM goal_budget_allocations gba
             JOIN goal_budget_items gbi ON gbi.id = gba.budget_item_id
             JOIN profiles p ON p.id = gba.profile_id
             LEFT JOIN goal_contributions gc ON gc.id = gba.source_id AND gba.source_type = 'contribution'
             LEFT JOIN goal_transaction_links gtl ON gtl.id = gba.source_id AND gba.source_type = 'transaction'
             LEFT JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
             WHERE gba.goal_id IN (${goalPlaceholders})
             ORDER BY gba.allocated_at DESC, gba.id DESC`,
          )
          .bind(...goalIds)
          .all<GoalBudgetAllocationWithDetails>()
      ).results ?? []
    : [];

  const rawLinks =
    flags.hasGoalTransactionLinks
      ? (
          await db
            .prepare(
              `SELECT
                 gtl.id,
                 gtl.goal_id,
                 gtl.transaction_id,
                 gtl.profile_id,
                 gtl.budget_item_id,
                 gtl.notes,
                 gtl.created_at,
                 ${
                   flags.hasGoalBudgetItems
                     ? "gbi.name AS budget_item_name"
                     : "NULL AS budget_item_name"
                 },
                 ROUND(oft.amount_cents / 100.0, 2) AS transaction_amount,
                 oft.posted_at AS transaction_posted_at,
                 oft.description AS transaction_description,
                 oft.merchant_name AS transaction_merchant_name,
                 oft.transaction_kind AS transaction_kind,
                 ${effectiveCategorySqlForSchema(flags)} AS transaction_effective_category,
                 oft.source_type AS transaction_source_type
               FROM goal_transaction_links gtl
               JOIN open_finance_transactions oft ON oft.id = gtl.transaction_id
               ${
                 flags.hasGoalBudgetItems
                   ? "LEFT JOIN goal_budget_items gbi ON gbi.id = gtl.budget_item_id"
                   : ""
               }
               WHERE gtl.goal_id IN (${goalPlaceholders})
               ORDER BY oft.posted_at DESC, gtl.id DESC`,
            )
            .bind(...goalIds)
            .all<GoalLinkedTransactionRow>()
        ).results ?? []
      : [];

  const contributionsByGoal = new Map<number, GoalContributionRow[]>();
  for (const contribution of contributions) {
    const bucket = contributionsByGoal.get(contribution.goal_id) ?? [];
    bucket.push(contribution);
    contributionsByGoal.set(contribution.goal_id, bucket);
  }

  const budgetItemsByGoal = new Map<number, GoalBudgetItemWithProgress[]>();
  for (const budgetItem of budgetItems) {
    const bucket = budgetItemsByGoal.get(budgetItem.goal_id) ?? [];
    bucket.push(withBudgetItemCalculations(budgetItem));
    budgetItemsByGoal.set(budgetItem.goal_id, bucket);
  }

  const participantsByGoal = new Map<number, GoalParticipantWithProfile[]>();
  for (const participant of participants) {
    const bucket = participantsByGoal.get(participant.goal_id) ?? [];
    bucket.push(participant);
    participantsByGoal.set(participant.goal_id, bucket);
  }

  const allocationsByGoal = new Map<number, GoalBudgetAllocationWithDetails[]>();
  for (const allocation of allocations) {
    const bucket = allocationsByGoal.get(allocation.goal_id) ?? [];
    bucket.push(allocation);
    allocationsByGoal.set(allocation.goal_id, bucket);
  }

  const linksByGoal = new Map<number, GoalLinkedTransaction[]>();
  for (const link of rawLinks) {
    if (
      link.transaction_amount === null ||
      !link.transaction_posted_at ||
      !link.transaction_description ||
      !link.transaction_kind ||
      !link.transaction_effective_category ||
      !link.transaction_source_type
    ) {
      continue;
    }

    const bucket = linksByGoal.get(link.goal_id) ?? [];
    bucket.push({
      ...link,
      transaction_amount: link.transaction_amount,
      transaction_posted_at: link.transaction_posted_at,
      transaction_description: link.transaction_description,
      transaction_merchant_name: link.transaction_merchant_name,
      transaction_kind: link.transaction_kind,
      transaction_effective_category: link.transaction_effective_category,
      transaction_source_type: link.transaction_source_type,
    });
    linksByGoal.set(link.goal_id, bucket);
  }

  return goals.map((goal) => {
    const goalBudgetItems = budgetItemsByGoal.get(goal.id) ?? [];
    const goalContributions = contributionsByGoal.get(goal.id) ?? [];
    const goalLinks = linksByGoal.get(goal.id) ?? [];
    const goalParticipants = participantsByGoal.get(goal.id) ?? [
      {
        id: 0,
        goal_id: goal.id,
        profile_id: goal.profile_id,
        role: "owner",
        contribution_weight: 1,
        created_at: goal.created_at,
        updated_at: goal.updated_at,
        profile_name: profileNameById.get(goal.profile_id) ?? "Perfil",
      },
    ];
    const goalAllocations = allocationsByGoal.get(goal.id) ?? [];
    const plannedBudgetTotal = goalBudgetItems.reduce((sum, item) => sum + item.planned_amount, 0);
    const allocatedBudgetTotal = goalBudgetItems.reduce((sum, item) => sum + item.allocated_amount, 0);
    const actualBudgetTotal = goalBudgetItems.reduce((sum, item) => sum + item.actual_amount, 0);
    const linkedSpendingTotal = goalLinks.reduce((sum, link) => sum + link.transaction_amount, 0);
    const contributionsByProfile = new Map<number, number>();
    for (const contribution of goalContributions) {
      contributionsByProfile.set(
        contribution.profile_id,
        (contributionsByProfile.get(contribution.profile_id) ?? 0) + contribution.amount,
      );
    }

    return {
      ...withGoalCalculations(goal),
      planned_budget_total: Math.round(plannedBudgetTotal * 100) / 100,
      allocated_budget_total: roundMoney(allocatedBudgetTotal),
      actual_budget_total: roundMoney(actualBudgetTotal),
      budget_remaining_total: roundMoney(Math.max(0, plannedBudgetTotal - allocatedBudgetTotal)),
      linked_spending_total: roundMoney(linkedSpendingTotal),
      contribution_count: goalContributions.length,
      participants: goalParticipants,
      contributions_by_profile: Array.from(contributionsByProfile.entries()).map(([participantProfileId, total]) => ({
        profile_id: participantProfileId,
        profile_name: profileNameById.get(participantProfileId) ?? "Perfil",
        total: roundMoney(total),
      })),
      latest_contributions: goalContributions.slice(0, 5),
      budget_items: goalBudgetItems,
      linked_transactions: goalLinks.slice(0, 8),
      recent_allocations: goalAllocations.slice(0, 8),
    };
  });
}
