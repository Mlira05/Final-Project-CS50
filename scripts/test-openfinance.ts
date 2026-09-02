// CS50 Final Project — scripts/test-openfinance.ts: Project validation or maintenance script.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import assert from 'node:assert/strict'
import { normalizeOpenFinanceCategory } from '../functions/_shared/category-normalizer.ts'
import { amountToCents, buildDedupeKey, normalizeDescription } from '../functions/_shared/openfinance/dedupe.ts'
import { normalizeBankTransaction } from '../functions/_shared/openfinance/normalize.ts'
import { buildSavingsInsights, summarizeByEffectiveCategory } from '../src/lib/analytics/financeInsights.ts'
import type { OpenFinanceTransaction } from '../src/types/finance.ts'

const normalized = await normalizeBankTransaction(1, 'account-1', {
  transactionId: 'tx-1',
  creditDebitType: 'DEBITO',
  transactionAmount: { amount: '12.3400', currency: 'BRL' },
  transactionDateTime: '2026-05-08T10:00:00.000Z',
  transactionName: 'Compra no débito|Mercado',
  type: 'OUTROS',
})

assert.equal(normalized.amountCents, 1234)
assert.equal(normalized.originalCategory, 'OUTROS')
assert.equal(normalized.merchantName, 'Mercado')
assert.equal(
  normalizeOpenFinanceCategory({
    originalCategory: 'OUTROS',
    description: 'Pagamento ifood',
    merchantName: 'iFood',
    transactionKind: 'bank_expense',
  }),
  'Delivery',
)

assert.equal(amountToCents('10.999'), 1100)
assert.equal(normalizeDescription(' Compra   no débito|Mercado '), 'compra no débito mercado')

const firstKey = await buildDedupeKey({
  ownerId: 1,
  source: 'cumbuca',
  sourceAccountId: 'account-1',
  transactionKind: 'bank_expense',
  postedAt: '2026-05-08T10:00:00.000Z',
  amountCents: 1234,
  description: 'Compra no débito|Mercado',
})
const secondKey = await buildDedupeKey({
  ownerId: 1,
  source: 'cumbuca',
  sourceAccountId: 'account-1',
  transactionKind: 'bank_expense',
  postedAt: '2026-05-08T10:00:00.000Z',
  amountCents: 1234,
  description: ' compra no débito  Mercado ',
})
assert.equal(firstKey, secondKey)

const transactions = [
  {
    transaction_kind: 'bank_expense',
    connection_id: null,
    amount: 80,
    original_category: 'OUTROS',
    system_category: 'Mercado',
    user_category: 'Alimentação',
  },
  {
    transaction_kind: 'credit_card_expense',
    connection_id: null,
    amount: 20,
    original_category: 'PAGAMENTO',
    system_category: 'Delivery',
    user_category: null,
  },
] as OpenFinanceTransaction[]

const categories = summarizeByEffectiveCategory(transactions)
assert.deepEqual(categories, [
  { category: 'Alimentação', total: 80 },
  { category: 'Delivery', total: 20 },
])

const insights = buildSavingsInsights(transactions, [])
assert.equal(insights[0]?.detail.includes('Alimentação'), true)

console.log('Open Finance tests passed')
