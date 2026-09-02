// CS50 Final Project — src/pages/Transactions.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, Eye, Link2, Pencil, RefreshCw, Save, Search, SlidersHorizontal, Undo2, WandSparkles } from 'lucide-react'
import { AtualizarDadosButton } from '../components/AtualizarDadosButton'
import { TransactionCategoryEditor } from '../components/TransactionCategoryEditor'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { FilterButton, FilterSheet } from '../components/ui/FilterSheet'
import { Input } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { api } from '../lib/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import {
  goalLinkBlockReason,
  openFinanceFlowLabel,
  openFinanceFlowToneClass,
  resolveOpenFinanceFlow,
} from '../lib/openFinanceFlow'
import type {
  Category,
  GoalBudgetItem,
  OpenFinanceFlowType,
  OpenFinanceTransaction,
  OpenFinanceTransactionDetails,
  Profile,
  SavingsGoal,
} from '../types/finance'

interface TransactionsProps {
  profile: Profile
  month: number
  year: number
  categories: Category[]
  dataVersion: number
  onDataChange: () => void
}

interface LinkFormState {
  goalId: string
  budgetItemId: string
  notes: string
  autoAllocate: boolean
}

const emptyLinkForm: LinkFormState = {
  goalId: '',
  budgetItemId: '',
  notes: '',
  autoAllocate: true,
}

const transactionKindOrder = [
  'bank_expense',
  'credit_card_expense',
  'bank_income',
  'refund',
  'transfer',
  'investment_transfer',
  'card_payment',
]

const transactionKindLabels: Record<string, string> = {
  bank_expense: 'Despesa bancaria',
  credit_card_expense: 'Despesa no cartao',
  bank_income: 'Renda bancaria',
  refund: 'Estornos',
  transfer: 'Transferencias',
  investment_transfer: 'Transferencia para investimento',
  card_payment: 'Pagamento de fatura',
}

function sourceLabel(sourceType: string) {
  return sourceType === 'credit_card' ? 'Cartao de credito' : 'Conta bancaria'
}

function kindLabel(kind: string) {
  const knownLabel = transactionKindLabels[kind]
  if (knownLabel) {
    return knownLabel
  }

  const normalized = kind.replace(/_/g, ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function FlowBadge({ flow }: { flow: OpenFinanceFlowType }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${openFinanceFlowToneClass(flow)}`}>
      {openFinanceFlowLabel(flow)}
    </span>
  )
}

function resolveEffectiveCategory(
  transaction: Pick<OpenFinanceTransaction, 'original_category' | 'system_category' | 'user_category'>,
) {
  for (const category of [transaction.user_category, transaction.system_category, transaction.original_category]) {
    if (typeof category === 'string' && category.trim()) {
      return category.trim()
    }
  }

  return 'Sem categoria'
}

function withDraftCategory(transaction: OpenFinanceTransaction, draftCategories: Record<number, string>) {
  if (!Object.prototype.hasOwnProperty.call(draftCategories, transaction.id)) {
    return transaction
  }

  const draftValue = draftCategories[transaction.id]
  const userCategory = draftValue.trim() ? draftValue : null

  return {
    ...transaction,
    user_category: userCategory,
    effective_category: resolveEffectiveCategory({
      ...transaction,
      user_category: userCategory,
    }),
    flow_type: resolveOpenFinanceFlow({
      effective_category: resolveEffectiveCategory({
        ...transaction,
        user_category: userCategory,
      }),
      transaction_kind: transaction.transaction_kind,
    }),
  }
}

function compareTransactionKinds(left: string, right: string) {
  const leftIndex = transactionKindOrder.indexOf(left)
  const rightIndex = transactionKindOrder.indexOf(right)

  if (leftIndex === -1 && rightIndex === -1) {
    return left.localeCompare(right)
  }

  if (leftIndex === -1) {
    return 1
  }

  if (rightIndex === -1) {
    return -1
  }

  return leftIndex - rightIndex
}

export function Transactions({ profile, month, year, categories, dataVersion, onDataChange }: TransactionsProps) {
  const [allTransactions, setAllTransactions] = useState<OpenFinanceTransaction[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [budgetItems, setBudgetItems] = useState<GoalBudgetItem[]>([])
  const [draftCategories, setDraftCategories] = useState<Record<number, string>>({})
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [flowFilter, setFlowFilter] = useState<'all' | OpenFinanceFlowType>('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savingCategories, setSavingCategories] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [message, setMessage] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkingTransaction, setLinkingTransaction] = useState<OpenFinanceTransaction | null>(null)
  const [linkForm, setLinkForm] = useState<LinkFormState>(emptyLinkForm)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsTransaction, setDetailsTransaction] = useState<OpenFinanceTransaction | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [detailsPayload, setDetailsPayload] = useState<OpenFinanceTransactionDetails | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const response = await api.transactions(profile.id, month, year)
      setAllTransactions(response.transactions)
      setDraftCategories({})
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar as transacoes.')
    } finally {
      setLoading(false)
    }
  }, [profile.id, month, year])

  const loadGoals = useCallback(async () => {
    try {
      const response = await api.goals(profile.id)
      setGoals(response.goals)
    } catch {
      setGoals([])
    }
  }, [profile.id])

  useEffect(() => {
    void load()
    void loadGoals()
  }, [load, loadGoals, dataVersion])

  const displayedTransactions = useMemo(
    () => allTransactions.map((transaction) => withDraftCategory(transaction, draftCategories)),
    [allTransactions, draftCategories],
  )

  const categoryOptions = useMemo(() => {
    const configuredNames = categories.map((category) => category.name)
    const configuredSet = new Set(configuredNames)
    const extraNames = Array.from(
      new Set(
        displayedTransactions
          .map((transaction) => transaction.effective_category)
          .filter((categoryName) => categoryName !== 'Sem categoria' && !configuredSet.has(categoryName)),
      ),
    ).sort((left, right) => left.localeCompare(right, 'pt-BR'))

    return [
      { label: 'Todas as categorias', value: 'all' },
      { label: 'Sem categoria', value: 'Sem categoria' },
      ...configuredNames.map((categoryName) => ({ label: categoryName, value: categoryName })),
      ...extraNames.map((categoryName) => ({ label: categoryName, value: categoryName })),
    ]
  }, [categories, displayedTransactions])

  const kindOptions = useMemo(() => {
    const kinds = Array.from(new Set(displayedTransactions.map((transaction) => transaction.transaction_kind))).sort(
      compareTransactionKinds,
    )

    return [
      { label: 'Todos os tipos', value: 'all' },
      ...kinds.map((kind) => ({ label: kindLabel(kind), value: kind })),
    ]
  }, [displayedTransactions])

  const flowOptions = useMemo(() => {
    const flows = Array.from(new Set(displayedTransactions.map((transaction) => transaction.flow_type)))

    return [
      { label: 'Todos os fluxos', value: 'all' },
      ...flows.map((flow) => ({ label: openFinanceFlowLabel(flow), value: flow })),
    ]
  }, [displayedTransactions])

  useEffect(() => {
    if (!categoryOptions.some((option) => option.value === categoryFilter)) {
      setCategoryFilter('all')
    }
  }, [categoryFilter, categoryOptions])

  useEffect(() => {
    if (!flowOptions.some((option) => option.value === flowFilter)) {
      setFlowFilter('all')
    }
  }, [flowFilter, flowOptions])

  useEffect(() => {
    if (!kindOptions.some((option) => option.value === kindFilter)) {
      setKindFilter('all')
    }
  }, [kindFilter, kindOptions])

  const filteredTransactions = useMemo(
    () =>
      displayedTransactions.filter((transaction) => {
        const matchesCategory = categoryFilter === 'all' || transaction.effective_category === categoryFilter
        const matchesFlow = flowFilter === 'all' || transaction.flow_type === flowFilter
        const matchesKind = kindFilter === 'all' || transaction.transaction_kind === kindFilter
        return matchesCategory && matchesFlow && matchesKind
      }),
    [displayedTransactions, categoryFilter, flowFilter, kindFilter],
  )

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === 'active'), [goals])

  const categoryTotals = useMemo(() => {
    const colorByCategory = new Map(categories.map((category) => [category.name, category.color]))
    const totals = new Map<string, number>()

    for (const transaction of displayedTransactions) {
      if (transaction.flow_type !== 'expense') {
        continue
      }

      totals.set(transaction.effective_category, (totals.get(transaction.effective_category) ?? 0) + Math.abs(transaction.amount))
    }

    return Array.from(totals.entries())
      .map(([category, total], index) => ({
        category,
        total,
        color: colorByCategory.get(category) ?? ['#8b5cf6', '#2563eb', '#14b8a6', '#f97316', '#64748b'][index % 5],
      }))
      .sort((left, right) => right.total - left.total)
  }, [categories, displayedTransactions])

  const categoryTotalSum = useMemo(
    () => categoryTotals.reduce((total, item) => total + item.total, 0),
    [categoryTotals],
  )

  const categoryDonut = useMemo(() => {
    if (!categoryTotals.length || categoryTotalSum <= 0) {
      return 'conic-gradient(var(--accent) 0deg, rgba(255,255,255,0.08) 0deg)'
    }

    let cursor = 0
    const stops = categoryTotals.slice(0, 6).map((item) => {
      const start = cursor
      const sweep = (item.total / categoryTotalSum) * 360
      cursor += sweep
      return `${item.color} ${start}deg ${cursor}deg`
    })

    return `conic-gradient(${stops.join(', ')})`
  }, [categoryTotals, categoryTotalSum])

  const pendingCategoryEntries = useMemo(
    () =>
      Object.entries(draftCategories).map(([transactionId, userCategory]) => ({
        transactionId: Number(transactionId),
        userCategory,
      })),
    [draftCategories],
  )

  const pendingTransactionIds = useMemo(
    () => new Set(pendingCategoryEntries.map((entry) => entry.transactionId)),
    [pendingCategoryEntries],
  )

  const pendingChangesCount = pendingCategoryEntries.length
  const hasPendingChanges = pendingChangesCount > 0
  const activeFilterCount = [categoryFilter !== 'all', flowFilter !== 'all', kindFilter !== 'all'].filter(Boolean).length

  useEffect(() => {
    async function loadBudgetItems() {
      if (!linkModalOpen || !linkForm.goalId) {
        setBudgetItems([])
        return
      }

      try {
        const response = await api.goalBudgetItems(Number(linkForm.goalId))
        setBudgetItems(response.items)
      } catch {
        setBudgetItems([])
      }
    }

    void loadBudgetItems()
  }, [linkForm.goalId, linkModalOpen])

  function blockPendingChanges(actionLabel: string) {
    if (!hasPendingChanges) {
      return false
    }

    setMessage('')
    setFeedbackError(
      pendingChangesCount === 1
        ? `Salve ou descarte a alteracao pendente antes de ${actionLabel}.`
        : `Salve ou descarte as ${pendingChangesCount} alteracoes pendentes antes de ${actionLabel}.`,
    )
    return true
  }

  function queueCategoryChange(transactionId: number, category: string) {
    const savedTransaction = allTransactions.find((transaction) => transaction.id === transactionId)
    if (!savedTransaction) {
      return
    }

    setFeedbackError('')
    setMessage('')

    const savedCategory = savedTransaction.user_category ?? ''

    setDraftCategories((current) => {
      if (category === savedCategory) {
        if (!Object.prototype.hasOwnProperty.call(current, transactionId)) {
          return current
        }

        const next = { ...current }
        delete next[transactionId]
        return next
      }

      return {
        ...current,
        [transactionId]: category,
      }
    })
  }

  async function savePendingCategories() {
    if (!pendingCategoryEntries.length) {
      return
    }

    setSavingCategories(true)
    setFeedbackError('')
    setMessage('')

    try {
      const results = await Promise.allSettled(
        pendingCategoryEntries.map(({ transactionId, userCategory }) =>
          api.updateTransactionCategory(transactionId, userCategory),
        ),
      )

      const updatedTransactions = new Map<number, OpenFinanceTransaction>()
      const savedTransactionIds: number[] = []
      let failedCount = 0
      let firstError = ''

      results.forEach((result, index) => {
        const { transactionId } = pendingCategoryEntries[index]

        if (result.status === 'fulfilled') {
          updatedTransactions.set(transactionId, result.value.transaction)
          savedTransactionIds.push(transactionId)
          return
        }

        failedCount += 1
        if (!firstError) {
          firstError = result.reason instanceof Error ? result.reason.message : 'Nao foi possivel salvar a categoria.'
        }
      })

      if (savedTransactionIds.length) {
        setAllTransactions((current) =>
          current.map((transaction) => updatedTransactions.get(transaction.id) ?? transaction),
        )
        setDraftCategories((current) => {
          const next = { ...current }
          for (const transactionId of savedTransactionIds) {
            delete next[transactionId]
          }
          return next
        })
        onDataChange()
      }

      if (!failedCount) {
        setMessage(
          savedTransactionIds.length === 1
            ? '1 categoria salva com sucesso.'
            : `${savedTransactionIds.length} categorias salvas com sucesso.`,
        )
        return
      }

      if (savedTransactionIds.length) {
        setMessage(
          savedTransactionIds.length === 1
            ? '1 categoria salva com sucesso.'
            : `${savedTransactionIds.length} categorias salvas com sucesso.`,
        )
      }

      setFeedbackError(
        failedCount === 1
          ? `1 alteracao nao foi salva. ${firstError}`
          : `${failedCount} alteracoes nao foram salvas. ${firstError}`,
      )
    } finally {
      setSavingCategories(false)
    }
  }

  function discardPendingChanges() {
    setDraftCategories({})
    setFeedbackError('')
    setMessage('Alteracoes locais descartadas.')
  }

  async function applyToSimilar(transaction: OpenFinanceTransaction) {
    if (blockPendingChanges('aplicar a categoria para transacoes parecidas')) {
      return
    }

    const category = transaction.effective_category
    const pattern = transaction.merchant_name?.trim() || transaction.description.trim()

    if (!pattern) {
      setFeedbackError('Essa transacao nao tem dados suficientes para localizar transacoes parecidas.')
      return
    }

    if (!category || category === 'Sem categoria') {
      setFeedbackError('Escolha uma categoria antes de aplicar para transacoes parecidas.')
      return
    }

    setFeedbackError('')
    setMessage('')
    setActionBusy(`similar-${transaction.id}`)

    try {
      const result = await api.applySimilarTransactionCategory(transaction.id, category)
      await load()
      onDataChange()

      if (result.futureAutomatic) {
        setMessage(
          result.appliedCount === 1
            ? `Categoria aplicada a 1 transacao parecida. Novas importacoes com "${result.pattern}" tambem serao categorizadas automaticamente.`
            : `Categoria aplicada a ${result.appliedCount} transacoes parecidas. Novas importacoes com "${result.pattern}" tambem serao categorizadas automaticamente.`,
        )
      } else {
        setMessage(
          result.appliedCount === 1
            ? `Categoria aplicada a 1 transacao parecida ja existente. A automacao para futuras importacoes ainda depende da migration 0004.`
            : `Categoria aplicada a ${result.appliedCount} transacoes parecidas ja existentes. A automacao para futuras importacoes ainda depende da migration 0004.`,
        )
      }
    } catch (requestError) {
      setFeedbackError(requestError instanceof Error ? requestError.message : 'Nao foi possivel aplicar a categoria em lote.')
    } finally {
      setActionBusy(null)
    }
  }

  function openLinkModal(transaction: OpenFinanceTransaction) {
    if (blockPendingChanges('vincular a transacao a um objetivo')) {
      return
    }

    const blockingReason = goalLinkBlockReason(transaction, activeGoals)
    if (blockingReason) {
      setMessage('')
      setFeedbackError(blockingReason)
      return
    }

    const firstGoal = activeGoals[0]
    setLinkingTransaction(transaction)
    setLinkForm({
      goalId: firstGoal ? String(firstGoal.id) : '',
      budgetItemId: '',
      notes: '',
      autoAllocate: true,
    })
    setBudgetItems(firstGoal?.budget_items ?? [])
    setLinkModalOpen(true)
  }

  async function saveLink(event: React.FormEvent) {
    event.preventDefault()

    if (!linkingTransaction || !linkForm.goalId) {
      setFeedbackError('Selecione um objetivo ativo para continuar.')
      return
    }

    setFeedbackError('')
    setMessage('')
    setActionBusy(`link-${linkingTransaction.id}`)

    try {
      await api.createGoalTransactionLink({
        goalId: Number(linkForm.goalId),
        transactionId: linkingTransaction.id,
        budgetItemId: linkForm.autoAllocate ? undefined : linkForm.budgetItemId ? Number(linkForm.budgetItemId) : undefined,
        autoAllocate: linkForm.autoAllocate,
        allocationStrategy: 'largest_first',
        notes: linkForm.notes.trim() || undefined,
      })
      setLinkModalOpen(false)
      setLinkingTransaction(null)
      setLinkForm(emptyLinkForm)
      await loadGoals()
      onDataChange()
      setMessage('Transacao vinculada ao objetivo.')
    } catch (requestError) {
      setFeedbackError(requestError instanceof Error ? requestError.message : 'Nao foi possivel vincular a transacao.')
    } finally {
      setActionBusy(null)
    }
  }

  function reloadTransactions() {
    if (blockPendingChanges('recarregar a lista')) {
      return
    }

    void load()
  }

  async function openDetails(transaction: OpenFinanceTransaction) {
    if (blockPendingChanges('abrir os detalhes Open Finance')) {
      return
    }

    setActionBusy(`details-${transaction.id}`)
    setDetailsTransaction(transaction)
    setDetailsModalOpen(true)
    setDetailsLoading(true)
    setDetailsError('')
    setDetailsPayload(null)

    try {
      const response = await api.transactionDetails(transaction.id)
      setDetailsPayload(response)
    } catch (requestError) {
      setDetailsError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar os detalhes.')
    } finally {
      setDetailsLoading(false)
      setActionBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {profile.name} - {month}/{year}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Transacoes</h2>
        </div>
        <div className="flex gap-2">
          <Button aria-label="Buscar" icon={<Search size={18} />} size="icon" variant="secondary" />
          <FilterButton activeCount={activeFilterCount} onClick={() => setFiltersOpen(true)} />
          <Button
            aria-label="Recarregar"
            disabled={loading || savingCategories}
            icon={<RefreshCw size={16} />}
            size="icon"
            onClick={reloadTransactions}
            variant="secondary"
          />
        </div>
      </div>

      <Card className="premium-gradient p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-violet-100/80">Conta/cartao principal</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Open Finance Cumbuca</h3>
          </div>
          <CreditCard className="text-violet-100" size={26} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-violet-100/70">Gasto no mês</p>
            <p className="number-tabular mt-1 text-2xl font-semibold text-white">{formatCurrency(categoryTotalSum)}</p>
          </div>
          <Button icon={<Pencil size={16} />} onClick={() => setMessage('Use Categorias para organizar fontes e classificacoes.')} size="sm" variant="secondary">
            Categorias
          </Button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${Math.min(100, categoryTotalSum ? 72 : 0)}%` }} />
        </div>
      </Card>

      {message ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {feedbackError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{feedbackError}</div>
      ) : null}

      {hasPendingChanges ? (
        <Card className="border-[var(--accent-border)] bg-[var(--accent-soft)]/35 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Alteracoes pendentes</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {pendingChangesCount === 1
                  ? 'Voce alterou 1 categoria. Salve quando terminar para evitar reload a cada mudanca.'
                  : `Voce alterou ${pendingChangesCount} categorias. Salve quando terminar para evitar reload a cada mudanca.`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                disabled={savingCategories}
                icon={<Undo2 size={16} />}
                onClick={discardPendingChanges}
                variant="ghost"
              >
                Descartar
              </Button>
              <Button
                disabled={savingCategories}
                icon={<Save size={16} />}
                onClick={() => void savePendingCategories()}
              >
                {savingCategories
                  ? 'Salvando...'
                  : pendingChangesCount === 1
                    ? 'Salvar 1 alteracao'
                    : `Salvar ${pendingChangesCount} alteracoes`}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {categoryTotals.length ? (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Gastos por categoria</h3>
              <p className="text-xs text-[var(--muted)]">{month}/{year}</p>
            </div>
            <Button onClick={() => setMessage('Use o lapis da lista para reclassificar.')} size="sm" variant="ghost">
              Editar categorias
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: categoryDonut }}>
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--bg)] text-center">
                <span className="text-[10px] text-[var(--muted)]">Total</span>
                <span className="number-tabular text-xs font-semibold text-[var(--text)]">{formatCurrency(categoryTotalSum)}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="grid gap-2">
                {categoryTotals.slice(0, 5).map((item) => (
                  <div className="flex items-center justify-between gap-3 text-xs" key={item.category}>
                    <span className="flex min-w-0 items-center gap-2 text-[var(--muted)]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="truncate">{item.category}</span>
                    </span>
                    <span className="number-tabular text-[var(--text)]">
                      {categoryTotalSum ? Math.round((item.total / categoryTotalSum) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center gap-2 rounded-[1rem] border border-[var(--border)] bg-[var(--accent-soft)]/35 px-3 py-2 text-xs text-[var(--muted-strong)]">
        <SlidersHorizontal size={14} className="text-[var(--accent)]" />
        Toque na categoria para reclassificar
      </div>

      {loading ? <LoadingState label="Carregando transacoes" /> : null}
      {loadError ? <ErrorState message={loadError} onRetry={load} /> : null}

      {!loading && !loadError && allTransactions.length === 0 ? (
        <EmptyState
          message="Clique em Atualizar dados para importar transacoes bancarias e do cartao."
          title="Nenhuma transacao importada neste mes"
        />
      ) : null}

      {!loading && !loadError && allTransactions.length > 0 && filteredTransactions.length === 0 ? (
        <EmptyState
          message="Ajuste os filtros para visualizar outras transacoes deste mes."
          title="Nenhuma transacao encontrada para os filtros atuais"
        />
      ) : null}

      {!loading && filteredTransactions.length > 0 ? (
        <Card className="hidden overflow-hidden lg:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-strong)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Descricao</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr className="border-t border-[var(--border)] align-top" key={transaction.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text)]">{transaction.merchant_name || transaction.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <FlowBadge flow={transaction.flow_type} />
                      <span className="text-xs text-[var(--muted)]">{kindLabel(transaction.transaction_kind)}</span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{transaction.description}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    <p>{sourceLabel(transaction.source_type)}</p>
                    <p className="mt-2 text-xs">{transaction.currency}</p>
                  </td>
                  <td className="px-4 py-3">
                    <TransactionCategoryEditor
                      categories={categories}
                      disabled={savingCategories}
                      onChange={queueCategoryChange}
                      pending={pendingTransactionIds.has(transaction.id)}
                      transaction={transaction}
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTime(transaction.posted_at)}</td>
                  <td className="number-tabular px-4 py-3 text-right font-semibold text-[var(--text)]">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        disabled={savingCategories || actionBusy === `similar-${transaction.id}`}
                        icon={<WandSparkles size={16} />}
                        onClick={() => void applyToSimilar(transaction)}
                        size="sm"
                        variant="ghost"
                      >
                        Aplicar para parecidas
                      </Button>
                      <Button
                        disabled={savingCategories || actionBusy === `link-${transaction.id}`}
                        icon={<Link2 size={16} />}
                        onClick={() => openLinkModal(transaction)}
                        size="sm"
                        variant="secondary"
                      >
                        Vincular a objetivo
                      </Button>
                      <Button
                        disabled={savingCategories || actionBusy === `details-${transaction.id}`}
                        icon={<Eye size={16} />}
                        onClick={() => void openDetails(transaction)}
                        size="sm"
                        variant="ghost"
                      >
                        Detalhes
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {!loading && filteredTransactions.length > 0 ? (
        <div className="grid gap-2.5 lg:hidden">
          {filteredTransactions.map((transaction) => (
            <Card className="p-3" key={transaction.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text)]">{transaction.merchant_name || transaction.description}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {sourceLabel(transaction.source_type)} · {formatDateTime(transaction.posted_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <FlowBadge flow={transaction.flow_type} />
                    <span className="text-xs text-[var(--muted)]">{kindLabel(transaction.transaction_kind)}</span>
                  </div>
                </div>
                <p className="number-tabular shrink-0 text-sm font-semibold text-[var(--text)]">{formatCurrency(transaction.amount)}</p>
              </div>
              <div className="mt-3">
                <TransactionCategoryEditor
                  categories={categories}
                  disabled={savingCategories}
                  onChange={queueCategoryChange}
                  pending={pendingTransactionIds.has(transaction.id)}
                  transaction={transaction}
                />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  disabled={savingCategories || actionBusy === `similar-${transaction.id}`}
                  icon={<WandSparkles size={16} />}
                  onClick={() => void applyToSimilar(transaction)}
                  size="icon"
                  variant="secondary"
                />
                <Button
                  disabled={savingCategories || actionBusy === `link-${transaction.id}`}
                  icon={<Link2 size={16} />}
                  onClick={() => openLinkModal(transaction)}
                  size="icon"
                  variant="ghost"
                />
                <Button
                  disabled={savingCategories || actionBusy === `details-${transaction.id}`}
                  icon={<Eye size={16} />}
                  onClick={() => void openDetails(transaction)}
                  size="icon"
                  variant="ghost"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <AtualizarDadosButton
        compact
        disabled={savingCategories || hasPendingChanges}
        disabledMessage={
          hasPendingChanges ? 'Salve ou descarte as alteracoes pendentes antes de atualizar os dados importados.' : undefined
        }
        onSynced={onDataChange}
        profile={profile}
      />

      <FilterSheet
        onApply={() => setFiltersOpen(false)}
        onClear={() => {
          setCategoryFilter('all')
          setFlowFilter('all')
          setKindFilter('all')
          setFiltersOpen(false)
        }}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      >
        <Select
          label="Categoria"
          onChange={(event) => setCategoryFilter(event.target.value)}
          options={categoryOptions}
          value={categoryFilter}
        />
        <Select
          label="Fluxo"
          onChange={(event) => setFlowFilter(event.target.value as 'all' | OpenFinanceFlowType)}
          options={flowOptions}
          value={flowFilter}
        />
        <Select
          label="Tipo Open Finance"
          onChange={(event) => setKindFilter(event.target.value)}
          options={kindOptions}
          value={kindFilter}
        />
      </FilterSheet>

      <Modal
        description={
          linkingTransaction
            ? `Vincule ${linkingTransaction.merchant_name || linkingTransaction.description} a um objetivo ativo.`
            : 'Escolha um objetivo ativo para relacionar a transacao.'
        }
        onClose={() => {
          setLinkModalOpen(false)
          setLinkingTransaction(null)
          setLinkForm(emptyLinkForm)
        }}
        open={linkModalOpen}
        title="Vincular a objetivo"
      >
        <form className="grid gap-4" onSubmit={saveLink}>
          <Select
            label="Objetivo ativo"
            onChange={(event) => setLinkForm({ ...linkForm, goalId: event.target.value, budgetItemId: '' })}
            options={activeGoals.map((goal) => ({ label: goal.name, value: goal.id }))}
            value={linkForm.goalId}
          />
          {budgetItems.length ? (
            <>
              <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <input
                  checked={linkForm.autoAllocate}
                  className="h-4 w-4 accent-[var(--accent)]"
                  onChange={(event) => setLinkForm({ ...linkForm, autoAllocate: event.target.checked, budgetItemId: '' })}
                  type="checkbox"
                />
                Distribuir automaticamente entre os itens do objetivo
              </label>
              {linkForm.autoAllocate ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--muted)]">
                  Esta transacao sera distribuida comecando pelos maiores itens ainda nao completos.
                </p>
              ) : (
                <Select
                  label="Item do orcamento"
                  onChange={(event) => setLinkForm({ ...linkForm, budgetItemId: event.target.value })}
                  options={[
                    { label: 'Sem item especifico', value: '' },
                    ...budgetItems.map((item) => ({ label: item.name, value: item.id })),
                  ]}
                  value={linkForm.budgetItemId}
                />
              )}
            </>
          ) : null}
          <Input
            label="Observacao"
            onChange={(event) => setLinkForm({ ...linkForm, notes: event.target.value })}
            placeholder="Ex.: gasto da viagem de julho"
            value={linkForm.notes}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setLinkModalOpen(false)
                setLinkingTransaction(null)
                setLinkForm(emptyLinkForm)
              }}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={!activeGoals.length || actionBusy === `link-${linkingTransaction?.id ?? 0}`} type="submit">
              {actionBusy === `link-${linkingTransaction?.id ?? 0}` ? 'Salvando...' : 'Salvar vinculo'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Campos normalizados do app e payload bruto retornado pela integracao Open Finance."
        onClose={() => {
          setDetailsModalOpen(false)
          setDetailsTransaction(null)
          setDetailsPayload(null)
          setDetailsError('')
        }}
        open={detailsModalOpen}
        title="Detalhes Open Finance"
      >
        <div className="grid gap-4">
          {detailsLoading ? <LoadingState label="Carregando detalhes Open Finance" /> : null}
          {detailsError && detailsTransaction ? (
            <ErrorState message={detailsError} onRetry={() => void openDetails(detailsTransaction)} />
          ) : null}
          {!detailsLoading && !detailsError && detailsPayload ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Fluxo</p>
                  <div className="mt-3">
                    <FlowBadge flow={detailsPayload.transaction.flow_type} />
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)]">{kindLabel(detailsPayload.transaction.transaction_kind)}</p>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Valor</p>
                  <p className="mt-3 number-tabular text-lg font-semibold text-[var(--text)]">
                    {formatCurrency(detailsPayload.transaction.amount)}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{detailsPayload.transaction.currency}</p>
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Descricao</p>
                  <p className="mt-2 text-[var(--text)]">
                    {detailsPayload.transaction.merchant_name || detailsPayload.transaction.description}
                  </p>
                  <p className="mt-1 text-[var(--muted)]">{detailsPayload.transaction.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Categoria efetiva</p>
                    <p className="mt-2 text-[var(--text)]">{detailsPayload.transaction.effective_category}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Origem</p>
                    <p className="mt-2 text-[var(--text)]">{sourceLabel(detailsPayload.transaction.source_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Conta/Fatura</p>
                    <p className="mt-2 break-all text-[var(--text)]">
                      {detailsPayload.transaction.source_account_id}
                      {detailsPayload.transaction.source_bill_id ? ` / ${detailsPayload.transaction.source_bill_id}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">ID externo</p>
                    <p className="mt-2 break-all text-[var(--text)]">{detailsPayload.transaction.external_id || 'Nao informado'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-black/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Payload bruto recebido</p>
                <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl bg-black/40 p-3 text-xs text-slate-200">
                  {JSON.stringify(detailsPayload.rawData, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
