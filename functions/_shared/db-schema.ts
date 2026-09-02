// CS50 Final Project — functions/_shared/db-schema.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { EFFECTIVE_CATEGORY_SQL } from "./category-normalizer";

interface TableInfoRow {
  name: string;
}

interface SqliteMasterRow {
  name: string;
}

export interface DbFeatureFlags {
  hasOpenFinanceTransactions: boolean;
  hasOpenFinanceSyncState: boolean;
  hasOpenFinanceSyncJobs: boolean;
  hasOpenFinanceConnections: boolean;
  hasSystemCategory: boolean;
  hasExpandedSavingsGoals: boolean;
  hasCategoryRules: boolean;
  hasGoalContributions: boolean;
  hasGoalBudgetItems: boolean;
  hasGoalTransactionLinks: boolean;
  hasGoalParticipants: boolean;
  hasGoalBudgetAllocations: boolean;
  hasGoalBudgetItemAllocatedAmount: boolean;
  hasGoalBudgetItemAllocationOrder: boolean;
  hasOpenFinanceConnectionId: boolean;
  hasOpenFinanceSyncStateConnectionId: boolean;
  hasOpenFinanceSyncJobsConnectionId: boolean;
  hasCumbucaConsentStates: boolean;
}

async function tableExists(db: D1Database, tableName: string) {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(tableName)
    .first<SqliteMasterRow>();

  return Boolean(row?.name);
}

async function tableColumns(db: D1Database, tableName: string) {
  if (!(await tableExists(db, tableName))) {
    return new Set<string>();
  }

  const { results = [] } = await db.prepare(`PRAGMA table_info(${tableName})`).all<TableInfoRow>();
  return new Set(results.map((column) => column.name));
}

export async function getDbFeatureFlags(db: D1Database): Promise<DbFeatureFlags> {
  const [
    openFinanceColumns,
    openFinanceSyncStateColumns,
    openFinanceSyncJobsColumns,
    savingsGoalColumns,
    budgetItemColumns,
    hasOpenFinanceConnections,
    hasCategoryRules,
    hasGoalContributions,
    hasGoalBudgetItems,
    hasGoalTransactionLinks,
    hasGoalParticipants,
    hasGoalBudgetAllocations,
    hasCumbucaConsentStates,
  ] = await Promise.all([
      tableColumns(db, "open_finance_transactions"),
      tableColumns(db, "open_finance_sync_state"),
      tableColumns(db, "open_finance_sync_jobs"),
      tableColumns(db, "savings_goals"),
      tableColumns(db, "goal_budget_items"),
      tableExists(db, "open_finance_connections"),
      tableExists(db, "category_rules"),
      tableExists(db, "goal_contributions"),
      tableExists(db, "goal_budget_items"),
      tableExists(db, "goal_transaction_links"),
      tableExists(db, "goal_participants"),
      tableExists(db, "goal_budget_allocations"),
      tableExists(db, "cumbuca_consent_states"),
    ]);

  return {
    hasOpenFinanceTransactions: openFinanceColumns.size > 0,
    hasOpenFinanceSyncState: openFinanceSyncStateColumns.size > 0,
    hasOpenFinanceSyncJobs: openFinanceSyncJobsColumns.size > 0,
    hasOpenFinanceConnections,
    hasSystemCategory: openFinanceColumns.has("system_category"),
    hasExpandedSavingsGoals:
      savingsGoalColumns.has("goal_type") &&
      savingsGoalColumns.has("priority") &&
      savingsGoalColumns.has("status") &&
      savingsGoalColumns.has("target_date") &&
      savingsGoalColumns.has("owner_mode"),
    hasCategoryRules,
    hasGoalContributions,
    hasGoalBudgetItems,
    hasGoalTransactionLinks,
    hasGoalParticipants,
    hasGoalBudgetAllocations,
    hasGoalBudgetItemAllocatedAmount: budgetItemColumns.has("allocated_amount"),
    hasGoalBudgetItemAllocationOrder: budgetItemColumns.has("allocation_order"),
    hasOpenFinanceConnectionId: openFinanceColumns.has("connection_id"),
    hasOpenFinanceSyncStateConnectionId: openFinanceSyncStateColumns.has("connection_id"),
    hasOpenFinanceSyncJobsConnectionId: openFinanceSyncJobsColumns.has("connection_id"),
    hasCumbucaConsentStates,
  };
}

export function effectiveCategorySqlForSchema(flags: Pick<DbFeatureFlags, "hasSystemCategory">) {
  return flags.hasSystemCategory
    ? EFFECTIVE_CATEGORY_SQL
    : "COALESCE(NULLIF(user_category, ''), NULLIF(original_category, ''), 'Sem categoria')";
}

export function openFinanceSystemCategorySelectSql(flags: Pick<DbFeatureFlags, "hasSystemCategory">) {
  return flags.hasSystemCategory ? "system_category" : "NULL AS system_category";
}

export function openFinanceConnectionIdSelectSql(flags: Pick<DbFeatureFlags, "hasOpenFinanceConnectionId">) {
  return flags.hasOpenFinanceConnectionId ? "connection_id" : "NULL AS connection_id";
}

export function savingsGoalsSelectSql(flags: Pick<DbFeatureFlags, "hasExpandedSavingsGoals">) {
  return `id,
          profile_id,
          name,
          target_amount,
          current_amount,
          deadline,
          ${flags.hasExpandedSavingsGoals ? "target_date" : "deadline AS target_date"},
          ${flags.hasExpandedSavingsGoals ? "goal_type" : "'general' AS goal_type"},
          ${flags.hasExpandedSavingsGoals ? "priority" : "'medium' AS priority"},
          ${flags.hasExpandedSavingsGoals ? "status" : "'active' AS status"},
          ${flags.hasExpandedSavingsGoals ? "owner_mode" : "'individual' AS owner_mode"},
          notes,
          created_at,
          updated_at`;
}

export function savingsGoalsOrderBySql(flags: Pick<DbFeatureFlags, "hasExpandedSavingsGoals">) {
  if (!flags.hasExpandedSavingsGoals) {
    return "deadline ASC, created_at DESC";
  }

  return `CASE status
            WHEN 'active' THEN 0
            WHEN 'paused' THEN 1
            WHEN 'completed' THEN 2
            ELSE 3
          END,
          CASE priority
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            ELSE 2
          END,
          COALESCE(target_date, deadline) ASC,
          created_at DESC`;
}
