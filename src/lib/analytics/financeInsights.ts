// CS50 Final Project — src/lib/analytics/financeInsights.ts: Client-side domain or infrastructure helper.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { FinanceInsight, OpenFinanceTransaction } from '../../types/finance'

function categoryOf(transaction: Pick<OpenFinanceTransaction, 'user_category' | 'system_category' | 'original_category'>) {
  return transaction.user_category?.trim() || transaction.system_category?.trim() || transaction.original_category?.trim() || 'Sem categoria'
}

function isExpense(transaction: Pick<OpenFinanceTransaction, 'transaction_kind'> & Partial<Pick<OpenFinanceTransaction, 'flow_type'>>) {
  if (transaction.flow_type) {
    return transaction.flow_type === 'expense'
  }

  return transaction.transaction_kind === 'bank_expense' || transaction.transaction_kind === 'credit_card_expense'
}

export function summarizeByEffectiveCategory(transactions: OpenFinanceTransaction[]) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (!isExpense(transaction)) {
      continue
    }

    const category = categoryOf(transaction)
    totals.set(category, (totals.get(category) ?? 0) + transaction.amount)
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((left, right) => right.total - left.total)
}

export function buildSavingsInsights(
  currentTransactions: OpenFinanceTransaction[],
  previousTransactions: OpenFinanceTransaction[] = [],
): FinanceInsight[] {
  const currentCategories = summarizeByEffectiveCategory(currentTransactions)
  const previousCategories = summarizeByEffectiveCategory(previousTransactions)
  const total = currentCategories.reduce((sum, category) => sum + category.total, 0)

  if (total <= 0) {
    return []
  }

  const insights: FinanceInsight[] = []
  const topCategory = currentCategories[0]
  if (topCategory) {
    const percentage = Math.round((topCategory.total / total) * 100)
    insights.push({
      title: 'Maior categoria do mês',
      detail: `Seu maior gasto no período foi ${topCategory.category}, representando ${percentage}% das despesas.`,
      amount: topCategory.total,
    })
  }

  const previous = new Map(previousCategories.map((category) => [category.category, category.total]))
  const increased = currentCategories
    .map((category) => ({ ...category, increase: category.total - (previous.get(category.category) ?? 0) }))
    .filter((category) => category.increase > 50)
    .sort((left, right) => right.increase - left.increase)[0]

  if (increased) {
    insights.push({
      title: 'Categoria em alta',
      detail: `${increased.category} aumentou em relação ao mês anterior.`,
      amount: Math.round(increased.increase * 100) / 100,
    })
  }

  return insights
}
