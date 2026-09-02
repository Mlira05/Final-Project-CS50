// CS50 Final Project — src/pages/Dashboard.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Briefcase,
  CreditCard,
  Grid2X2,
  Heart,
  ListChecks,
  Plus,
  RefreshCw,
  ShoppingCart,
  Target,
  WalletCards,
  Wifi,
  Zap,
} from 'lucide-react'
import { AppLogo } from '../components/brand/AppLogo'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState } from '../components/ui/ErrorState'
import { FilterButton, FilterSheet } from '../components/ui/FilterSheet'
import { LoadingState } from '../components/ui/LoadingState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Select } from '../components/ui/Select'
import { api } from '../lib/api'
import { currentMonthYear, formatCurrency, formatDateTime, formatPercent, monthNames } from '../lib/format'
import type { AppTab, DashboardAction, DashboardSummary, OpenFinanceTransaction, Profile } from '../types/finance'

interface DashboardProps {
  profile: Profile
  month: number
  year: number
  accent: string
  dataVersion: number
  openFinanceSync: {
    connected: boolean
    error: string
    lastSuccessAt: string
    loading: boolean
    message: string
  }
  onNavigate: (tab: AppTab) => void
  onOpenFinanceSync: () => void
  onQuickAction: (kind: 'expense' | 'income') => void
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
}

function signedAmount(transaction: OpenFinanceTransaction) {
  return transaction.flow_type === 'income' || transaction.flow_type === 'refund'
    ? `+ ${formatCurrency(Math.abs(transaction.amount))}`
    : `- ${formatCurrency(Math.abs(transaction.amount))}`
}

function transactionIcon(transaction: OpenFinanceTransaction) {
  const category = transaction.effective_category.toLowerCase()
  if (transaction.flow_type === 'income' || transaction.flow_type === 'refund') {
    return <Briefcase size={16} />
  }
  if (category.includes('aliment')) {
    return <ShoppingCart size={16} />
  }
  if (category.includes('saude')) {
    return <Heart size={16} />
  }
  return transaction.source_type === 'credit_card' ? <CreditCard size={16} /> : <WalletCards size={16} />
}

function upcomingFallback(summary: DashboardSummary): DashboardAction[] {
  if (summary.importantActions.length) {
    return summary.importantActions.slice(0, 3)
  }

  return summary.recurringMerchants.slice(0, 3).map((merchant, index) => ({
    id: `${merchant.merchant}-${index}`,
    title: merchant.merchant,
    detail: `${merchant.count} lancamentos recorrentes`,
    amount: merchant.total,
    severity: 'info',
  }))
}

export function Dashboard({
  profile,
  month,
  year,
  accent,
  dataVersion,
  openFinanceSync,
  onNavigate,
  onOpenFinanceSync,
  onQuickAction,
  onMonthChange,
  onYearChange,
}: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.dashboard(profile.id, month, year)
      setSummary(response.summary)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar o resumo.')
    } finally {
      setLoading(false)
    }
  }, [profile.id, month, year])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  const netWorth = useMemo(
    () =>
      summary
        ? summary.remainingBalance + summary.totalStoredMoney + summary.totalCurrentSavingsTowardGoals
        : 0,
    [summary],
  )

  const monthlyVariation = useMemo(() => {
    const points = summary?.monthlyBalanceProgression ?? []
    if (points.length < 2) {
      return 0
    }

    const current = points[points.length - 1]?.balance ?? 0
    const previous = points[points.length - 2]?.balance ?? 0
    return previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100
  }, [summary])

  const primaryGoal = useMemo(
    () =>
      summary?.goals.find((goal) => goal.goal_type === 'emergency_reserve') ??
      summary?.goals.find((goal) => goal.status === 'active') ??
      summary?.goals[0] ??
      null,
    [summary],
  )

  const yearOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => year - 3 + index), [year])
  const currentPeriod = currentMonthYear()
  const filterCount = month !== currentPeriod.month || year !== currentPeriod.year ? 1 : 0
  const donutBackground = useMemo(() => {
    if (!summary) {
      return `conic-gradient(${accent} 0deg, rgba(255,255,255,0.08) 0deg)`
    }

    const pieces = [
      { value: Math.max(0, summary.remainingBalance), color: accent },
      { value: Math.max(0, summary.monthlyIncome), color: '#14d6c6' },
      { value: Math.max(0, summary.totalMonthlyExpenses), color: '#ff5065' },
      { value: Math.max(0, summary.totalCurrentSavingsTowardGoals + summary.totalStoredMoney), color: '#4b2b91' },
    ].filter((piece) => piece.value > 0)

    const total = pieces.reduce((sum, piece) => sum + piece.value, 0)
    if (!pieces.length || total <= 0) {
      return `conic-gradient(${accent} 0deg, rgba(255,255,255,0.08) 0deg)`
    }

    let cursor = 0
    const stops = pieces.map((piece) => {
      const start = cursor
      cursor += (piece.value / total) * 360
      return `${piece.color} ${start}deg ${cursor}deg`
    })

    return `conic-gradient(${stops.join(', ')})`
  }, [accent, summary])

  if (loading) {
    return <LoadingState label="Carregando inicio" />
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  if (!summary) {
    return null
  }

  const upcomingBills = upcomingFallback(summary)

  return (
    <div className="mx-auto grid max-w-md gap-4">
      <header className="flex min-h-14 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AppLogo size="sm" />
          <div className="min-w-0">
            <h2 className="text-[1.45rem] font-semibold leading-tight text-[var(--text)]">Inicio</h2>
            <p className="truncate text-xs text-[var(--muted)]">
              {profile.name} · {monthNames[month - 1]} {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FilterButton activeCount={filterCount} onClick={() => setFiltersOpen(true)} label="Periodo" />
          <Button aria-label="Notificacoes" icon={<Bell size={17} />} size="icon" variant="ghost" />
        </div>
      </header>

      <Card className="premium-gradient overflow-hidden p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-violet-100/90">Patrimonio liquido</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-violet-100">mensal</span>
            </div>
            <p className="number-tabular mt-8 text-[2rem] font-semibold leading-none tracking-tight text-white">
              {formatCurrency(netWorth)}
            </p>
            <p className={`mt-3 text-sm ${monthlyVariation >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              vs mes passado {monthlyVariation >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(monthlyVariation))}
            </p>
          </div>
          <div
            className="relative grid aspect-square place-items-center rounded-full shadow-[0_0_34px_rgba(139,92,246,0.35)]"
            style={{ background: donutBackground }}
          >
            <div className="grid h-[58%] w-[58%] place-items-center rounded-full bg-[#070b17] text-center shadow-inner">
              <span>
                <span className="block text-xs text-[var(--muted)]">Total</span>
                <span className="number-tabular mt-1 block text-sm font-medium text-white">{formatCurrency(netWorth)}</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-3 gap-2.5">
        <Card className="min-w-0 p-3">
          <p className="text-xs text-[var(--muted)]">Receitas do mes</p>
          <p className="number-tabular mt-2 truncate text-[1.05rem] font-semibold text-[var(--success)]">
            {formatCurrency(summary.monthlyIncome)}
          </p>
          <ArrowUpRight className="mt-1 text-[var(--success)]" size={15} />
        </Card>
        <Card className="min-w-0 p-3">
          <p className="text-xs text-[var(--muted)]">Despesas do mes</p>
          <p className="number-tabular mt-2 truncate text-[1.05rem] font-semibold text-[var(--danger)]">
            {formatCurrency(summary.totalMonthlyExpenses)}
          </p>
          <ArrowDownRight className="mt-1 text-[var(--danger)]" size={15} />
        </Card>
        <Card className="min-w-0 p-3">
          <p className="text-xs text-[var(--muted)]">Saldo do mes</p>
          <p className="number-tabular mt-2 truncate text-[1.05rem] font-semibold text-[var(--accent)]">
            {formatCurrency(summary.remainingBalance)}
          </p>
          <WalletCards className="mt-1 text-[var(--accent)]" size={15} />
        </Card>
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">Proximas contas</h3>
          <Button onClick={() => onNavigate('expenses')} size="sm" variant="ghost">
            Ver todas
          </Button>
        </div>
        <Card className="overflow-hidden">
          {upcomingBills.length ? (
            <div className="divide-y divide-[var(--border)]">
              {upcomingBills.map((bill, index) => (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5" key={bill.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      {[<Zap size={16} key="zap" />, <Wifi size={16} key="wifi" />, <Heart size={16} key="heart" />][index] ?? <Zap size={16} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{bill.title}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{bill.detail || 'Previsto para este periodo'}</p>
                    </div>
                  </div>
                  <p className="number-tabular shrink-0 text-sm font-medium text-[var(--text)]">{formatCurrency(Math.abs(bill.amount))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-[var(--muted)]">Nenhuma conta recorrente para exibir.</p>
          )}
        </Card>
      </section>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text)]">Transacoes recentes</h3>
          <Button onClick={() => onNavigate('transactions')} size="sm" variant="ghost">
            Ver todas
          </Button>
        </div>
        <Card className="overflow-hidden">
          {summary.recentTransactions.length ? (
            <div className="divide-y divide-[var(--border)]">
              {summary.recentTransactions.slice(0, 3).map((transaction) => {
                const positive = transaction.flow_type === 'income' || transaction.flow_type === 'refund'

                return (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5" key={transaction.id}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          positive ? 'bg-emerald-500/12 text-[var(--success)]' : 'bg-red-500/12 text-[var(--danger)]'
                        }`}
                      >
                        {transactionIcon(transaction)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text)]">
                          {transaction.merchant_name || transaction.description}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">Hoje · {transaction.effective_category}</p>
                      </div>
                    </div>
                    <p
                      className={`number-tabular shrink-0 text-sm font-medium ${
                        positive ? 'text-[var(--success)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {signedAmount(transaction)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-[var(--muted)]">Atualize os dados para ver lancamentos recentes.</p>
          )}
        </Card>
      </section>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <RefreshCw className={openFinanceSync.loading ? 'animate-spin' : ''} size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">Open Finance</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {openFinanceSync.message ||
                  (openFinanceSync.error
                    ? 'Nao foi possivel atualizar.'
                    : 'Atualize para garantir as informacoes mais recentes.')}
              </p>
            </div>
          </div>
          <Button
            className="h-10 min-w-[8.5rem] whitespace-nowrap rounded-full px-4 leading-none"
            disabled={openFinanceSync.loading}
            onClick={onOpenFinanceSync}
            size="sm"
            variant="primary"
          >
            {openFinanceSync.loading ? 'Atualizando' : 'Atualizar dados'}
          </Button>
        </div>
        <p className={`mt-3 text-[11px] ${openFinanceSync.error ? 'text-red-300' : 'text-[var(--muted)]'}`}>
          {openFinanceSync.error ||
            (openFinanceSync.lastSuccessAt ? `Ultima atualizacao: ${formatDateTime(openFinanceSync.lastSuccessAt)}` : 'Ainda sem atualizacao registrada.')}
        </p>
      </Card>

      {primaryGoal ? (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Meta reserva de emergencia</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">{primaryGoal.name}</p>
            </div>
            <Button onClick={() => onNavigate('goals')} size="sm" variant="ghost">
              Editar
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[7px] border-[var(--accent)] bg-[var(--accent-soft)]">
              <span className="number-tabular text-sm font-semibold text-[var(--text)]">{formatPercent(primaryGoal.progress_percentage)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="number-tabular text-xl font-semibold text-[var(--text)]">{formatCurrency(primaryGoal.current_amount)}</p>
              <p className="text-xs text-[var(--muted)]">de {formatCurrency(primaryGoal.target_amount)}</p>
              <ProgressBar label={`${formatCurrency(primaryGoal.remaining_amount)} faltando`} value={primaryGoal.progress_percentage} />
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: 'Despesa', icon: <Plus size={17} />, action: () => onQuickAction('expense') },
          { label: 'Receita', icon: <ArrowUpRight size={17} />, action: () => onQuickAction('income') },
          { label: 'Categorias', icon: <Grid2X2 size={17} />, tab: 'settings' as AppTab },
          { label: 'Transacoes', icon: <ListChecks size={17} />, tab: 'transactions' as AppTab },
          { label: 'Metas', icon: <Target size={17} />, tab: 'goals' as AppTab },
          { label: 'Mais', icon: <WalletCards size={17} />, tab: 'settings' as AppTab },
        ].map((item) => (
          <button
            className="focus-ring grid min-h-[64px] place-items-center gap-1 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-2 text-center text-[11px] font-medium text-[var(--text)]"
            key={item.label}
            onClick={() => {
              if ('action' in item && item.action) {
                item.action()
                return
              }

              if ('tab' in item) {
                onNavigate(item.tab)
              }
            }}
            type="button"
          >
            <span className="text-[var(--accent)]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </section>

      <FilterSheet
        onApply={() => setFiltersOpen(false)}
        onClear={() => {
          onMonthChange(currentPeriod.month)
          onYearChange(currentPeriod.year)
          setFiltersOpen(false)
        }}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      >
        <Select
          label="Mes"
          onChange={(event) => onMonthChange(Number(event.target.value))}
          options={monthNames.map((name, index) => ({ label: name, value: index + 1 }))}
          value={month}
        />
        <Select
          label="Ano"
          onChange={(event) => onYearChange(Number(event.target.value))}
          options={yearOptions.map((item) => ({ label: String(item), value: item }))}
          value={year}
        />
      </FilterSheet>
    </div>
  )
}
