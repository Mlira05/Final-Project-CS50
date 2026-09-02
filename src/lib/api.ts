// CS50 Final Project — src/lib/api.ts: Client-side domain or infrastructure helper.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type {
  AuthStatus,
  Category,
  CategoryRule,
  DashboardSummary,
  Expense,
  GoalBudgetItem,
  GoalContribution,
  GoalLinkedTransaction,
  MonthlyIncome,
  OpenFinanceReprocessResult,
  OpenFinanceApplySimilarResult,
  OpenFinanceConsentLinkResponse,
  OpenFinanceConnection,
  OpenFinanceSyncResult,
  OpenFinanceSyncStateResponse,
  OpenFinanceTransactionDetails,
  OpenFinanceTransaction,
  Profile,
  ReserveEntry,
  SavingsGoal,
} from '../types/finance'

type JsonRecord = Record<string, unknown>

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as JsonRecord | null

  if (!response.ok) {
    throw new Error(String(payload?.error ?? 'Nao foi possivel concluir a requisicao.'))
  }

  if (!payload) {
    throw new Error('Resposta invalida da API.')
  }

  return payload as T
}

function body(data: JsonRecord) {
  return JSON.stringify(data)
}

export const api = {
  authStatus: () => request<AuthStatus>('/auth/status'),
  login: (pin: string, profileId?: number) =>
    request<{ ok: true }>('/auth/login', {
      method: 'POST',
      body: body({ pin, profileId }),
    }),
  loginProfiles: () => request<{ profiles: Profile[] }>('/auth/profiles'),
  logout: () =>
    request<{ ok: true }>('/auth/logout', {
      method: 'POST',
      body: body({}),
    }),
  profiles: () => request<{ profiles: Profile[] }>('/profiles'),
  createProfile: (name: string) =>
    request<{ profile: Profile }>('/profiles', {
      method: 'POST',
      body: body({ name }),
    }),
  updateProfile: (id: number, name: string) =>
    request<{ profile: Profile }>('/profiles', {
      method: 'PUT',
      body: body({ id, name }),
    }),
  deleteProfile: (id: number) =>
    request<{ ok: true }>('/profiles', {
      method: 'DELETE',
      body: body({ id }),
    }),
  updateProfilePin: (profileId: number, currentPin: string, newPin: string) =>
    request<{ ok: true }>('/profile-pin', {
      method: 'PUT',
      body: body({ profileId, currentPin, newPin }),
    }),
  categories: (profileId: number) => request<{ categories: Category[] }>(`/categories?profileId=${profileId}`),
  createCategory: (payload: JsonRecord) =>
    request<{ category: Category }>('/categories', {
      method: 'POST',
      body: body(payload),
    }),
  updateCategory: (payload: JsonRecord) =>
    request<{ category: Category }>('/categories', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteCategory: (id: number, replacementCategory?: string) =>
    request<{ ok: true }>('/categories', {
      method: 'DELETE',
      body: body({ id, replacementCategory }),
    }),
  categoryRules: (profileId: number) =>
    request<{ rules: CategoryRule[] }>(`/category-rules?profileId=${profileId}`),
  createCategoryRule: (payload: JsonRecord) =>
    request<{ rule: CategoryRule }>('/category-rules', {
      method: 'POST',
      body: body(payload),
    }),
  updateCategoryRule: (payload: JsonRecord) =>
    request<{ rule: CategoryRule }>('/category-rules', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteCategoryRule: (id: number) =>
    request<{ ok: true }>('/category-rules', {
      method: 'DELETE',
      body: body({ id }),
    }),
  dashboard: (profileId: number, month: number, year: number) =>
    request<{ summary: DashboardSummary }>(`/dashboard?profileId=${profileId}&month=${month}&year=${year}`),
  openFinanceSyncState: (profileId: number) =>
    request<OpenFinanceSyncStateResponse>(`/openfinance/sync-state?profileId=${profileId}`),
  openFinanceConnections: (profileId?: number) =>
    request<{ connections: OpenFinanceConnection[] }>(
      `/openfinance/connections${profileId ? `?profileId=${profileId}` : ''}`,
    ),
  saveOpenFinanceConnection: (payload: JsonRecord) =>
    request<{ connection: OpenFinanceConnection }>('/openfinance/connections', {
      method: 'POST',
      body: body(payload),
    }),
  updateOpenFinanceConnection: (payload: JsonRecord) =>
    request<{ connection: OpenFinanceConnection }>('/openfinance/connections', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteOpenFinanceConnection: (id: number) =>
    request<{ ok: true; connection: OpenFinanceConnection }>('/openfinance/connections', {
      method: 'DELETE',
      body: body({ id }),
    }),
  migrateLegacyOpenFinanceConnection: (profileId: number) =>
    request<{ connection: OpenFinanceConnection; migrated: boolean }>('/openfinance/migrate-legacy-connection', {
      method: 'POST',
      body: body({ profileId }),
    }),
  createOpenFinanceConsentLink: (profileId: number) =>
    request<OpenFinanceConsentLinkResponse>('/openfinance/create-consent-link', {
      method: 'POST',
      body: body({ profileId }),
    }),
  syncOpenFinance: (profileId: number, fullImport = false) =>
    request<OpenFinanceSyncResult>('/openfinance/sync', {
      method: 'POST',
      body: body({ profileId, fullImport }),
    }),
  reprocessOpenFinanceCategories: (profileId: number) =>
    request<OpenFinanceReprocessResult>('/openfinance/reprocess-categories', {
      method: 'POST',
      body: body({ profileId }),
    }),
  transactions: (profileId: number, month: number, year: number, category = 'all', kind = 'all', flow = 'all') =>
    request<{ transactions: OpenFinanceTransaction[] }>(
      `/transactions?profileId=${profileId}&month=${month}&year=${year}&category=${encodeURIComponent(
        category,
      )}&kind=${encodeURIComponent(kind)}&flow=${encodeURIComponent(flow)}`,
    ),
  transactionDetails: (id: number) => request<OpenFinanceTransactionDetails>(`/transactions/${id}/details`),
  updateTransactionCategory: (id: number, userCategory: string) =>
    request<{ transaction: OpenFinanceTransaction }>(`/transactions/${id}/category`, {
      method: 'PATCH',
      body: body({ userCategory }),
    }),
  applySimilarTransactionCategory: (transactionId: number, category: string) =>
    request<OpenFinanceApplySimilarResult>('/transactions/apply-similar', {
      method: 'POST',
      body: body({ transactionId, category }),
    }),
  monthlyIncome: (profileId: number, month: number, year: number) =>
    request<{ income: MonthlyIncome | null }>(`/monthly-income?profileId=${profileId}&month=${month}&year=${year}`),
  saveMonthlyIncome: (payload: JsonRecord) =>
    request<{ income: MonthlyIncome }>('/monthly-income', {
      method: 'POST',
      body: body(payload),
    }),
  updateMonthlyIncome: (payload: JsonRecord) =>
    request<{ income: MonthlyIncome }>('/monthly-income', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteMonthlyIncome: (id: number, applyToFuture = true) =>
    request<{ ok: true }>('/monthly-income', {
      method: 'DELETE',
      body: body({ id, applyToFuture }),
    }),
  expenses: (profileId: number, month: number, year: number, category = 'all', paymentMethod = 'all') =>
    request<{ expenses: Expense[] }>(
      `/expenses?profileId=${profileId}&month=${month}&year=${year}&category=${encodeURIComponent(
        category,
      )}&paymentMethod=${encodeURIComponent(paymentMethod)}`,
    ),
  createExpense: (payload: JsonRecord) =>
    request<{ expense: Expense }>('/expenses', {
      method: 'POST',
      body: body(payload),
    }),
  updateExpense: (payload: JsonRecord) =>
    request<{ expense: Expense }>('/expenses', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteExpense: (id: number, applyToFuture = true) =>
    request<{ ok: true }>('/expenses', {
      method: 'DELETE',
      body: body({ id, applyToFuture }),
    }),
  goals: (profileId: number) => request<{ goals: SavingsGoal[] }>(`/savings-goals?profileId=${profileId}`),
  createGoal: (payload: JsonRecord) =>
    request<{ goal: SavingsGoal | null }>('/savings-goals', {
      method: 'POST',
      body: body(payload),
    }),
  updateGoal: (payload: JsonRecord) =>
    request<{ goal: SavingsGoal | null }>('/savings-goals', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteGoal: (id: number) =>
    request<{ ok: true }>('/savings-goals', {
      method: 'DELETE',
      body: body({ id }),
    }),
  addMoneyToGoal: (
    goalId: number,
    amount: number,
    contributionDate?: string,
    source?: string,
    notes?: string,
    options: JsonRecord = {},
  ) =>
    request<{ goal: SavingsGoal | null; contribution: GoalContribution | null }>('/savings-goals/add-money', {
      method: 'POST',
      body: body({ goalId, amount, contributionDate, source, notes, ...options }),
    }),
  goalContributions: (goalId: number) =>
    request<{ contributions: GoalContribution[] }>(`/savings-goals/contributions?goalId=${goalId}`),
  deleteGoalContribution: (id: number) =>
    request<{ ok: true }>('/savings-goals/contributions', {
      method: 'DELETE',
      body: body({ id }),
    }),
  goalBudgetItems: (goalId: number) =>
    request<{ items: GoalBudgetItem[] }>(`/goal-budget-items?goalId=${goalId}`),
  createGoalBudgetItem: (payload: JsonRecord) =>
    request<{ item: GoalBudgetItem | null }>('/goal-budget-items', {
      method: 'POST',
      body: body(payload),
    }),
  updateGoalBudgetItem: (payload: JsonRecord) =>
    request<{ item: GoalBudgetItem | null }>('/goal-budget-items', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteGoalBudgetItem: (id: number) =>
    request<{ ok: true }>('/goal-budget-items', {
      method: 'DELETE',
      body: body({ id }),
    }),
  goalTransactionLinks: (goalId: number) =>
    request<{ links: GoalLinkedTransaction[] }>(`/goal-transaction-links?goalId=${goalId}`),
  createGoalTransactionLink: (payload: JsonRecord) =>
    request<{ links: GoalLinkedTransaction[] }>('/goal-transaction-links', {
      method: 'POST',
      body: body(payload),
    }),
  deleteGoalTransactionLink: (id: number) =>
    request<{ ok: true }>('/goal-transaction-links', {
      method: 'DELETE',
      body: body({ id }),
    }),
  reserveEntries: (profileId: number) => request<{ entries: ReserveEntry[] }>(`/reserve-entries?profileId=${profileId}`),
  createReserveEntry: (payload: JsonRecord) =>
    request<{ entry: ReserveEntry }>('/reserve-entries', {
      method: 'POST',
      body: body(payload),
    }),
  updateReserveEntry: (payload: JsonRecord) =>
    request<{ entry: ReserveEntry }>('/reserve-entries', {
      method: 'PUT',
      body: body(payload),
    }),
  deleteReserveEntry: (id: number) =>
    request<{ ok: true }>('/reserve-entries', {
      method: 'DELETE',
      body: body({ id }),
    }),
}
