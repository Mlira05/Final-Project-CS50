// CS50 Final Project — functions/_shared/types.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export interface Env {
  DB: D1Database;
  APP_PIN?: string;
  SESSION_SECRET?: string;
  ALLOW_CLOUDFLARE_ACCESS?: string;
  CUMBUCA_MCP_URL?: string;
  CUMBUCA_MCP_ACCESS_TOKEN?: string;
  CUMBUCA_MCP_REFRESH_TOKEN?: string;
  CUMBUCA_MCP_CLIENT_ID?: string;
  CUMBUCA_MCP_TOKEN_URL?: string;
  CUMBUCA_AUTHORIZATION_URL?: string;
  CUMBUCA_REDIRECT_URI?: string;
  OPEN_FINANCE_TOKEN_ENCRYPTION_KEY?: string;
}

export interface ProfileRow {
  id: number;
  name: string;
  pin_hash: string | null;
  pin_salt: string | null;
  created_at: string;
  updated_at: string;
}

export interface CumbucaConsentStateRow {
  id: number;
  state: string;
  profile_id: number;
  nonce: string;
  status: string;
  created_at: string;
  consumed_at: string | null;
}

export interface PublicProfileRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyIncomeRow {
  id: number;
  profile_id: number;
  month: number;
  year: number;
  amount: number;
  notes: string | null;
  is_recurring: number;
  recurrence_group_id: string | null;
  recurrence_start_month: number | null;
  recurrence_start_year: number | null;
  recurrence_end_month: number | null;
  recurrence_end_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: number;
  profile_id: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  payment_method: string;
  is_recurring: number;
  recurrence_group_id: string | null;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalRow {
  id: number;
  profile_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  target_date: string | null;
  goal_type: string;
  priority: string;
  status: string;
  owner_mode: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReserveEntryRow {
  id: number;
  profile_id: number;
  name: string;
  purpose: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: number;
  profile_id: number | null;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface OpenFinanceTransactionRow {
  id: number;
  owner_id: number;
  connection_id: number | null;
  source: string;
  source_type: string;
  source_account_id: string;
  source_bill_id: string | null;
  external_id: string | null;
  dedupe_key: string;
  transaction_kind: string;
  amount_cents: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  original_category: string | null;
  system_category: string | null;
  user_category: string | null;
  posted_at: string;
  raw_json: string;
  created_at: string;
  updated_at: string;
}

export interface PublicOpenFinanceTransactionRow
  extends Omit<OpenFinanceTransactionRow, "raw_json"> {
  effective_category: string;
  flow_type: string;
  amount: number;
}

export interface OpenFinanceSyncStateRow {
  id: number;
  owner_id: number;
  connection_id: number | null;
  provider: string;
  status: string;
  first_import_started_at: string | null;
  last_sync_started_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenFinanceSyncJobRow {
  id: number;
  owner_id: number;
  connection_id: number | null;
  provider: string;
  status: string;
  date_from: string;
  date_to: string;
  inserted_count: number;
  skipped_count: number;
  updated_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenFinanceConnectionRow {
  id: number;
  profile_id: number;
  provider: string;
  holder_name: string | null;
  document_last4: string | null;
  document_hash: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  client_id_encrypted: string | null;
  token_url: string | null;
  mcp_url: string | null;
  token_expires_at: string | null;
  consent_status: string;
  status: string;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicOpenFinanceConnection {
  id: number;
  profile_id: number;
  provider: string;
  holder_name: string | null;
  document_last4: string | null;
  document_hash: string | null;
  token_url: string | null;
  mcp_url: string | null;
  token_expires_at: string | null;
  consent_status: string;
  status: string;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  has_access_token: boolean;
  has_refresh_token: boolean;
  has_client_id: boolean;
}

export interface CategoryRuleRow {
  id: number;
  profile_id: number;
  match_type: string;
  pattern: string;
  category: string;
  priority: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface GoalContributionRow {
  id: number;
  goal_id: number;
  profile_id: number;
  amount: number;
  contribution_date: string;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalBudgetItemRow {
  id: number;
  goal_id: number;
  profile_id: number;
  name: string;
  category: string;
  planned_amount: number;
  allocated_amount: number;
  actual_amount: number;
  allocation_order: number;
  allocation_strategy: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalParticipantRow {
  id: number;
  goal_id: number;
  profile_id: number;
  role: string;
  contribution_weight: number;
  created_at: string;
  updated_at: string;
}

export interface GoalBudgetAllocationRow {
  id: number;
  goal_id: number;
  budget_item_id: number;
  profile_id: number;
  source_type: string;
  source_id: number | null;
  amount: number;
  allocated_at: string;
  notes: string | null;
  created_at: string;
}

export interface GoalTransactionLinkRow {
  id: number;
  goal_id: number;
  transaction_id: number;
  profile_id: number;
  budget_item_id: number | null;
  notes: string | null;
  created_at: string;
}
