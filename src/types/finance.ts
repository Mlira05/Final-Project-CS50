// CS50 Final Project — src/types/finance.ts: Shared TypeScript data contracts.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export interface Profile {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface MonthlyIncome {
  id: number
  profile_id: number
  month: number
  year: number
  amount: number
  notes: string | null
  is_recurring: number
  recurrence_group_id: string | null
  recurrence_start_month: number | null
  recurrence_start_year: number | null
  recurrence_end_month: number | null
  recurrence_end_year: number | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  profile_id: number
  name: string
  category: string
  amount: number
  date: string
  payment_method: string
  is_recurring: number
  recurrence_group_id: string | null
  recurrence_start_date: string | null
  recurrence_end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  profile_id: number | null
  name: string
  color: string
  created_at: string
  updated_at: string
}

export type GoalType = 'general' | 'travel' | 'emergency_reserve' | 'purchase' | 'debt_payment' | 'investment'
export type GoalPriority = 'low' | 'medium' | 'high'
export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type GoalOwnerMode = 'individual' | 'shared'
export type CategoryRuleMatchType = 'merchant' | 'description' | 'original_category' | 'contains'
export type OpenFinanceFlowType = 'expense' | 'income' | 'transfer' | 'investment' | 'refund' | 'card_payment' | 'other'
export type AllocationStrategy = 'largest_first' | 'smallest_first' | 'manual_order'
export type OpenFinanceConnectionDisplayStatus = 'profile_connected' | 'legacy_connected' | 'disconnected' | 'error'

export interface GoalContribution {
  id: number
  goal_id: number
  profile_id: number
  amount: number
  contribution_date: string
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GoalBudgetItem {
  id: number
  goal_id: number
  profile_id: number
  name: string
  category: string
  planned_amount: number
  allocated_amount: number
  actual_amount: number
  allocation_order: number
  allocation_strategy: string
  notes: string | null
  created_at: string
  updated_at: string
  remaining_amount: number
  spent_remaining_amount: number
  progress_percentage: number
  spent_percentage: number
  allocation_percentage: number
}

export interface GoalLinkedTransaction {
  id: number
  goal_id: number
  transaction_id: number
  profile_id: number
  budget_item_id: number | null
  notes: string | null
  created_at: string
  budget_item_name: string | null
  transaction_amount: number
  transaction_posted_at: string
  transaction_description: string
  transaction_merchant_name: string | null
  transaction_kind: string
  transaction_effective_category: string
  transaction_source_type: string
}

export interface SavingsGoal {
  id: number
  profile_id: number
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  target_date: string | null
  goal_type: GoalType
  priority: GoalPriority
  status: GoalStatus
  owner_mode: GoalOwnerMode
  notes: string | null
  created_at: string
  updated_at: string
  remaining_amount: number
  progress_percentage: number
  months_left: number
  monthly_savings_needed: number
  planned_budget_total: number
  allocated_budget_total: number
  actual_budget_total: number
  budget_remaining_total: number
  linked_spending_total: number
  contribution_count: number
  participants: GoalParticipant[]
  contributions_by_profile: Array<{
    profile_id: number
    profile_name: string
    total: number
  }>
  latest_contributions: GoalContribution[]
  budget_items: GoalBudgetItem[]
  linked_transactions: GoalLinkedTransaction[]
  recent_allocations: GoalBudgetAllocation[]
}

export interface GoalParticipant {
  id: number
  goal_id: number
  profile_id: number
  role: string
  contribution_weight: number
  profile_name: string
  created_at: string
  updated_at: string
}

export interface GoalBudgetAllocation {
  id: number
  goal_id: number
  budget_item_id: number
  profile_id: number
  source_type: string
  source_id: number | null
  amount: number
  allocated_at: string
  notes: string | null
  created_at: string
  budget_item_name: string
  profile_name: string
  source_label: string | null
}

export interface ReserveEntry {
  id: number
  profile_id: number
  name: string
  purpose: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseCategorySummary {
  category: string
  total: number
  color: string
}

export interface BalanceProgressionPoint {
  label: string
  month: number
  year: number
  income: number
  expenses: number
  balance: number
}

export interface DashboardAction {
  id: string
  title: string
  detail: string
  amount: number
  severity: string
}

export interface DashboardSummary {
  monthlyIncome: number
  totalMonthlyExpenses: number
  remainingBalance: number
  incomeSpentPercentage: number
  manualIncome: number
  importedIncome: number
  manualExpenses: number
  importedExpenses: number
  bankAccountExpenses: number
  creditCardExpenses: number
  totalStoredMoney: number
  totalSavingsGoalTargetAmount: number
  totalCurrentSavingsTowardGoals: number
  savingsProgressPercentage: number
  expensesByCategory: ExpenseCategorySummary[]
  monthlyBalanceProgression: BalanceProgressionPoint[]
  goals: SavingsGoal[]
  importedExpensesBySource: Array<{ sourceType: string; total: number }>
  topMerchants: Array<{ merchant: string; total: number; count: number }>
  recurringMerchants: Array<{ merchant: string; total: number; count: number }>
  recentTransactions: OpenFinanceTransaction[]
  uncategorizedTransactionsCount: number
  savingsInsights: FinanceInsight[]
  categoryMonthComparison: Array<{
    category: string
    currentTotal: number
    previousTotal: number
    difference: number
    color: string
  }>
  topIncreasingCategories: Array<{
    category: string
    currentTotal: number
    previousTotal: number
    difference: number
    color: string
  }>
  goalLinkedSpending: Array<{ goalId: number; goalName: string; total: number }>
  budgetAlerts: DashboardAction[]
  importantActions: DashboardAction[]
}

export interface AuthStatus {
  authenticated: boolean
  configured: boolean
  mode: 'profile' | 'pin' | 'access' | 'locked'
  profileId: number | null
  profileName: string | null
  user: string | null
}

export interface OpenFinanceTransaction {
  id: number
  owner_id: number
  connection_id: number | null
  source: string
  source_type: 'bank_account' | 'credit_card' | string
  source_account_id: string
  source_bill_id: string | null
  external_id: string | null
  dedupe_key: string
  transaction_kind: string
  amount_cents: number
  amount: number
  currency: string
  description: string
  merchant_name: string | null
  original_category: string | null
  system_category: string | null
  user_category: string | null
  effective_category: string
  flow_type: OpenFinanceFlowType
  posted_at: string
  created_at: string
  updated_at: string
}

export interface OpenFinanceTransactionDetails {
  transaction: OpenFinanceTransaction
  rawData: unknown
}

export interface OpenFinanceSyncJob {
  id: number
  owner_id: number
  connection_id: number | null
  provider: string
  status: string
  date_from: string
  date_to: string
  inserted_count: number
  skipped_count: number
  updated_count: number
  error_message: string | null
  started_at: string
  finished_at: string | null
  created_at: string
  updated_at: string
}

export interface OpenFinanceSyncState {
  id: number
  owner_id: number
  connection_id: number | null
  provider: string
  status: string
  first_import_started_at: string | null
  last_sync_started_at: string | null
  last_success_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface OpenFinanceConnection {
  id: number
  profile_id: number
  provider: string
  holder_name: string | null
  document_last4: string | null
  document_hash: string | null
  token_url: string | null
  mcp_url: string | null
  token_expires_at: string | null
  consent_status: string
  status: string
  last_success_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  has_access_token: boolean
  has_refresh_token: boolean
  has_client_id: boolean
}

export interface OpenFinanceSyncStateResponse {
  connected: boolean
  usingLegacyGlobalConnection: boolean
  activeConnection: OpenFinanceConnection | null
  connections: OpenFinanceConnection[]
  connectionDisplayStatus: OpenFinanceConnectionDisplayStatus
  lastSuccessAt: string | null
  lastError: string | null
  status: string
  state: OpenFinanceSyncState | null
  jobs: OpenFinanceSyncJob[]
}

export interface OpenFinanceConsentLinkResponse {
  url: string | null
  mode: 'external_link' | 'manual_token'
  message: string
}

export interface OpenFinanceSyncResult {
  success: true
  mode: 'initial_import' | 'incremental_update'
  dateFrom: string
  dateTo: string
  inserted: number
  skipped: number
  updated: number
  lastSuccessAt: string
  connectionId: number | null
  usingLegacyGlobalConnection: boolean
}

export interface OpenFinanceReprocessResult {
  ok: true
  processed: number
  updated: number
}

export interface OpenFinanceApplySimilarResult {
  ok: true
  appliedCount: number
  category: string
  pattern: string
  matchType: 'merchant' | 'description'
  futureAutomatic: boolean
}

export interface CategoryRule {
  id: number
  profile_id: number
  match_type: CategoryRuleMatchType
  pattern: string
  category: string
  priority: number
  is_active: number
  created_at: string
  updated_at: string
}

export interface FinanceInsight {
  title: string
  detail: string
  amount: number
}

export type AppTab = 'dashboard' | 'transactions' | 'expenses' | 'income' | 'goals' | 'reserve' | 'settings'

export type ThemeMode = 'dark' | 'light'

export interface AccentOption {
  label: string
  value: string
}
