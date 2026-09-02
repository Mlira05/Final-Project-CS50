// CS50 Final Project — src/lib/openFinanceFlow.ts: Client-side domain or infrastructure helper.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { OpenFinanceFlowType, OpenFinanceTransaction, SavingsGoal } from '../types/finance'

const incomeCategoryTerms = [
  'renda',
  'salario',
  'salário',
  'pro labore',
  'pro-labore',
  'recebimento',
  'recebimentos',
  'rendimento',
  'rendimentos',
  'bonus',
  'bônus',
  'bonificacao',
  'bonificação',
  'comissao',
  'comissão',
  'dividendo',
  'dividendos',
]

const transferCategoryTerms = ['transferencia', 'transferência', 'transferencias', 'transferências', 'pix', 'ted', 'doc']
const investmentCategoryTerms = ['investimento', 'investimentos', 'aporte', 'aplicacao', 'aplicação', 'corretora', 'tesouro', 'cdb']
const refundCategoryTerms = ['estorno', 'estornos', 'reembolso', 'chargeback']
const cardPaymentCategoryTerms = ['pagamento de fatura', 'pagamento fatura', 'fatura cartao', 'fatura cartão', 'pagamento cartao', 'pagamento cartão']

const flowLabels: Record<OpenFinanceFlowType, string> = {
  expense: 'Saida',
  income: 'Entrada',
  transfer: 'Transferencia',
  investment: 'Investimento',
  refund: 'Estorno',
  card_payment: 'Pagamento de fatura',
  other: 'Outro',
}

const flowToneClasses: Record<OpenFinanceFlowType, string> = {
  expense: 'border-red-500/30 bg-red-500/10 text-red-200',
  income: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  transfer: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  investment: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  refund: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  card_payment: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  other: 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted-strong)]',
}

export function openFinanceFlowLabel(flow: OpenFinanceFlowType) {
  return flowLabels[flow] ?? flowLabels.other
}

export function openFinanceFlowToneClass(flow: OpenFinanceFlowType) {
  return flowToneClasses[flow] ?? flowToneClasses.other
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAnyTerm(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeComparableText(term)))
}

function categoryDrivenFlow(category: string | null | undefined): OpenFinanceFlowType | null {
  const comparable = normalizeComparableText(category)
  if (!comparable || comparable === 'sem categoria') {
    return null
  }

  if (includesAnyTerm(comparable, refundCategoryTerms)) {
    return 'refund'
  }

  if (includesAnyTerm(comparable, cardPaymentCategoryTerms)) {
    return 'card_payment'
  }

  if (includesAnyTerm(comparable, investmentCategoryTerms)) {
    return 'investment'
  }

  if (includesAnyTerm(comparable, transferCategoryTerms)) {
    return 'transfer'
  }

  if (includesAnyTerm(comparable, incomeCategoryTerms)) {
    return 'income'
  }

  return null
}

export function resolveOpenFinanceFlow(transaction: Pick<OpenFinanceTransaction, 'effective_category' | 'transaction_kind'>) {
  const byCategory = categoryDrivenFlow(transaction.effective_category)
  if (byCategory) {
    return byCategory
  }

  switch (transaction.transaction_kind) {
    case 'bank_income':
      return 'income'
    case 'bank_expense':
    case 'credit_card_expense':
      return 'expense'
    case 'refund':
      return 'refund'
    case 'card_payment':
      return 'card_payment'
    case 'investment_transfer':
      return 'investment'
    case 'transfer':
      return 'transfer'
    default:
      return 'other'
  }
}

export function canLinkGoalTransaction(transaction: Pick<OpenFinanceTransaction, 'flow_type'>) {
  return transaction.flow_type === 'expense'
}

export function goalLinkBlockReason(
  transaction: Pick<OpenFinanceTransaction, 'flow_type' | 'merchant_name' | 'description'>,
  activeGoals: SavingsGoal[],
) {
  if (!activeGoals.length) {
    return 'Crie ou ative pelo menos um objetivo antes de vincular transacoes.'
  }

  if (!canLinkGoalTransaction(transaction)) {
    return `${transaction.merchant_name || transaction.description} esta classificada como ${openFinanceFlowLabel(
      transaction.flow_type,
    ).toLowerCase()} e so despesas podem ser vinculadas a objetivos.`
  }

  return ''
}
