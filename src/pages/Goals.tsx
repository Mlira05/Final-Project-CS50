// CS50 Final Project — src/pages/Goals.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Edit3, Link2, Plane, Plus, Trash2, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, formatPercent, nextYearDate } from '../lib/format'
import type {
  GoalBudgetItem,
  GoalOwnerMode,
  GoalPriority,
  GoalStatus,
  GoalType,
  Profile,
  SavingsGoal,
} from '../types/finance'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { FilterButton, FilterSheet } from '../components/ui/FilterSheet'
import { Input, Textarea } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Select } from '../components/ui/Select'

interface GoalsProps {
  profile: Profile
  profiles: Profile[]
  dataVersion: number
  onDataChange: () => void
}

interface GoalForm {
  name: string
  targetAmount: string
  currentAmount: string
  targetDate: string
  goalType: GoalType
  priority: GoalPriority
  status: GoalStatus
  ownerMode: GoalOwnerMode
  participantProfileIds: number[]
  createDefaultBudgetItems: boolean
  notes: string
}

interface ContributionForm {
  amount: string
  contributionDate: string
  source: string
  notes: string
  autoAllocate: boolean
  allocationStrategy: 'largest_first' | 'smallest_first' | 'manual_order'
}

interface BudgetItemForm {
  name: string
  category: string
  plannedAmount: string
  notes: string
}

const goalTypeOptions: Array<{ label: string; value: GoalType }> = [
  { label: 'Geral', value: 'general' },
  { label: 'Viagem', value: 'travel' },
  { label: 'Reserva de emergência', value: 'emergency_reserve' },
  { label: 'Compra planejada', value: 'purchase' },
  { label: 'Quitar dívida', value: 'debt_payment' },
  { label: 'Investimento', value: 'investment' },
]

const priorityOptions: Array<{ label: string; value: GoalPriority }> = [
  { label: 'Alta', value: 'high' },
  { label: 'Média', value: 'medium' },
  { label: 'Baixa', value: 'low' },
]

const statusOptions: Array<{ label: string; value: GoalStatus }> = [
  { label: 'Ativa', value: 'active' },
  { label: 'Pausada', value: 'paused' },
  { label: 'Concluída', value: 'completed' },
  { label: 'Cancelada', value: 'cancelled' },
]

const ownerOptions: Array<{ label: string; value: GoalOwnerMode }> = [
  { label: 'Individual', value: 'individual' },
  { label: 'Compartilhada', value: 'shared' },
]

const emptyGoalForm = (): GoalForm => ({
  name: '',
  targetAmount: '',
  currentAmount: '0',
  targetDate: nextYearDate(),
  goalType: 'general',
  priority: 'medium',
  status: 'active',
  ownerMode: 'individual',
  participantProfileIds: [],
  createDefaultBudgetItems: true,
  notes: '',
})

const emptyContributionForm = (): ContributionForm => ({
  amount: '',
  contributionDate: new Date().toISOString().slice(0, 10),
  source: '',
  notes: '',
  autoAllocate: true,
  allocationStrategy: 'largest_first',
})

const emptyBudgetItemForm = (): BudgetItemForm => ({
  name: '',
  category: '',
  plannedAmount: '0',
  notes: '',
})

function goalTypeLabel(value: GoalType) {
  return goalTypeOptions.find((option) => option.value === value)?.label ?? value
}

function priorityLabel(value: GoalPriority) {
  return priorityOptions.find((option) => option.value === value)?.label ?? value
}

function statusLabel(value: GoalStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value
}

function ownerModeLabel(value: GoalOwnerMode) {
  return ownerOptions.find((option) => option.value === value)?.label ?? value
}

function goalTargetDate(goal: SavingsGoal) {
  return goal.target_date ?? goal.deadline
}

function goalCardTone(goal: SavingsGoal) {
  if (goal.priority === 'high' && goal.status === 'active') {
    return 'border-amber-400/40 bg-amber-400/8'
  }

  if (goal.goal_type === 'travel') {
    return 'border-sky-400/30 bg-sky-400/6'
  }

  return 'border-[var(--border)] bg-[var(--surface)]'
}

export function Goals({ profile, profiles, dataVersion, onDataChange }: GoalsProps) {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GoalStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | GoalType>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | GoalPriority>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [contributionModalOpen, setContributionModalOpen] = useState(false)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null)
  const [budgetGoal, setBudgetGoal] = useState<SavingsGoal | null>(null)
  const [editingBudgetItem, setEditingBudgetItem] = useState<GoalBudgetItem | null>(null)
  const [form, setForm] = useState<GoalForm>(emptyGoalForm)
  const [contributionForm, setContributionForm] = useState<ContributionForm>(emptyContributionForm)
  const [budgetForm, setBudgetForm] = useState<BudgetItemForm>(emptyBudgetItemForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.goals(profile.id)
      setGoals(response.goals)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as metas.')
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  const filteredGoals = useMemo(
    () =>
      goals.filter((goal) => {
        if (statusFilter !== 'all' && goal.status !== statusFilter) {
          return false
        }

        if (typeFilter !== 'all' && goal.goal_type !== typeFilter) {
          return false
        }

        if (priorityFilter !== 'all' && goal.priority !== priorityFilter) {
          return false
        }

        return true
      }),
    [goals, priorityFilter, statusFilter, typeFilter],
  )

  const highlightedGoal = useMemo(
    () =>
      filteredGoals.find((goal) => goal.status === 'active' && goal.priority === 'high') ??
      filteredGoals.find((goal) => goal.status === 'active') ??
      filteredGoals[0] ??
      null,
    [filteredGoals],
  )

  const goalSummary = useMemo(
    () => ({
      saved: goals.reduce((total, goal) => total + goal.current_amount, 0),
      active: goals.filter((goal) => goal.status === 'active').length,
      target: goals.reduce((total, goal) => total + goal.target_amount, 0),
    }),
    [goals],
  )
  const activeFilterCount = [statusFilter !== 'all', typeFilter !== 'all', priorityFilter !== 'all'].filter(Boolean).length

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyGoalForm(), participantProfileIds: [profile.id] })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(goal: SavingsGoal) {
    setEditing(goal)
    setForm({
      name: goal.name,
      targetAmount: String(goal.target_amount),
      currentAmount: String(goal.current_amount),
      targetDate: goalTargetDate(goal),
      goalType: goal.goal_type,
      priority: goal.priority,
      status: goal.status,
      ownerMode: goal.owner_mode,
      participantProfileIds: goal.participants?.length
        ? goal.participants.map((participant) => participant.profile_id)
        : [goal.profile_id],
      createDefaultBudgetItems: false,
      notes: goal.notes ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function openContribution(goal: SavingsGoal) {
    setContributionGoal(goal)
    setContributionForm(emptyContributionForm())
    setFormError('')
    setContributionModalOpen(true)
  }

  function openBudget(goal: SavingsGoal, item?: GoalBudgetItem) {
    setBudgetGoal(goal)
    setEditingBudgetItem(item ?? null)
    setBudgetForm(
      item
        ? {
            name: item.name,
            category: item.category,
            plannedAmount: String(item.planned_amount),
            notes: item.notes ?? '',
          }
        : emptyBudgetItemForm(),
    )
    setFormError('')
    setBudgetModalOpen(true)
  }

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const targetAmount = Number(form.targetAmount)
    const currentAmount = Number(form.currentAmount)

    if (!form.name.trim()) {
      setFormError('Adicione um nome para o objetivo.')
      return
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setFormError('O valor da meta precisa ser maior que zero.')
      return
    }

    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
      setFormError('O valor guardado não pode ser negativo.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        profileId: profile.id,
        name: form.name.trim(),
        targetAmount,
        currentAmount,
        targetDate: form.targetDate,
        goalType: form.goalType,
        priority: form.priority,
        status: form.status,
        ownerMode: form.ownerMode,
        participantProfileIds: form.ownerMode === 'shared' ? form.participantProfileIds : [profile.id],
        createDefaultBudgetItems: form.createDefaultBudgetItems,
        notes: form.notes,
      }

      if (editing) {
        await api.updateGoal({ ...payload, id: editing.id })
        setMessage('Objetivo atualizado.')
      } else {
        await api.createGoal(payload)
        setMessage('Objetivo criado.')
      }

      setModalOpen(false)
      onDataChange()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o objetivo.')
    } finally {
      setSaving(false)
    }
  }

  async function addContribution(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const amount = Number(contributionForm.amount)

    if (!contributionGoal || !Number.isFinite(amount) || amount <= 0) {
      setFormError('O valor precisa ser maior que zero.')
      return
    }

    setSaving(true)

    try {
      await api.addMoneyToGoal(
        contributionGoal.id,
        amount,
        contributionForm.contributionDate,
        contributionForm.source,
        contributionForm.notes,
        {
          profileId: profile.id,
          autoAllocate: contributionForm.autoAllocate,
          allocationStrategy: contributionForm.allocationStrategy,
        },
      )
      setContributionModalOpen(false)
      setContributionGoal(null)
      onDataChange()
      await load()
      setMessage('Aporte registrado com sucesso.')
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível adicionar o aporte.')
    } finally {
      setSaving(false)
    }
  }

  async function saveBudgetItem(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!budgetGoal) {
      setFormError('Escolha um objetivo para salvar o item do orçamento.')
      return
    }

    const plannedAmount = Number(budgetForm.plannedAmount)
    if (!budgetForm.name.trim()) {
      setFormError('Defina um nome para o item de orçamento.')
      return
    }

    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
      setFormError('O valor planejado precisa ser zero ou maior.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        goalId: budgetGoal.id,
        name: budgetForm.name.trim(),
        category: budgetForm.category.trim() || budgetForm.name.trim(),
        plannedAmount,
        notes: budgetForm.notes,
      }

      if (editingBudgetItem) {
        await api.updateGoalBudgetItem({ ...payload, id: editingBudgetItem.id })
        setMessage('Item de orçamento atualizado.')
      } else {
        await api.createGoalBudgetItem(payload)
        setMessage('Item de orçamento criado.')
      }

      setBudgetModalOpen(false)
      setBudgetGoal(null)
      setEditingBudgetItem(null)
      onDataChange()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o item do orçamento.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteGoal(goal: SavingsGoal) {
    if (!window.confirm(`Excluir "${goal.name}"?`)) {
      return
    }

    await api.deleteGoal(goal.id)
    onDataChange()
    await load()
    setMessage('Objetivo excluído.')
  }

  async function deleteContribution(contributionId: number) {
    if (!window.confirm('Excluir este aporte?')) {
      return
    }

    await api.deleteGoalContribution(contributionId)
    onDataChange()
    await load()
    setMessage('Aporte excluído.')
  }

  async function deleteBudgetItem(itemId: number) {
    if (!window.confirm('Excluir este item do orçamento?')) {
      return
    }

    await api.deleteGoalBudgetItem(itemId)
    onDataChange()
    await load()
    setMessage('Item de orçamento excluído.')
  }

  async function unlinkTransaction(linkId: number) {
    if (!window.confirm('Remover o vínculo desta transação com o objetivo?')) {
      return
    }

    await api.deleteGoalTransactionLink(linkId)
    onDataChange()
    await load()
    setMessage('Vínculo removido.')
  }

  async function applyBudgetAsTarget(goal: SavingsGoal) {
    if (goal.planned_budget_total <= 0) {
      return
    }

    await api.updateGoal({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.planned_budget_total,
      currentAmount: goal.current_amount,
      targetDate: goalTargetDate(goal),
      goalType: goal.goal_type,
      priority: goal.priority,
      status: goal.status,
      ownerMode: goal.owner_mode,
      notes: goal.notes,
    })
    onDataChange()
    await load()
    setMessage('Valor planejado do orçamento aplicado como meta principal.')
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">{profile.name}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Metas</h2>
        </div>
        <div className="flex gap-2">
          <FilterButton activeCount={activeFilterCount} onClick={() => setFiltersOpen(true)} />
          <Button aria-label="Novo objetivo" icon={<Plus size={16} />} onClick={openCreate} size="icon" />
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-[var(--muted)]">Total guardado</p>
          <p className="number-tabular mt-2 text-sm font-semibold text-[var(--success)]">{formatCurrency(goalSummary.saved)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-[var(--muted)]">Metas ativas</p>
          <p className="number-tabular mt-2 text-sm font-semibold text-[var(--accent)]">{goalSummary.active}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-[var(--muted)]">Meta total</p>
          <p className="number-tabular mt-2 text-sm font-semibold text-[var(--text)]">{formatCurrency(goalSummary.target)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] p-1 text-sm">
        <button className="rounded-xl bg-[var(--accent-soft)] py-2 font-medium text-[var(--text)]" type="button">
          Objetivos
        </button>
        <button className="rounded-xl py-2 text-[var(--muted)]" type="button">
          Reserva
        </button>
      </div>

      {loading ? <LoadingState label="Carregando objetivos" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && goals.length === 0 ? (
        <EmptyState
          action={
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Adicionar objetivo
            </Button>
          }
          message="Crie um alvo, prazo e valor inicial para viagens, reservas, compras e planos compartilhados."
          title="Nenhum objetivo cadastrado"
        />
      ) : null}

      {!loading && !error && goals.length > 0 && filteredGoals.length === 0 ? (
        <EmptyState
          message="Ajuste os filtros para ver outros objetivos."
          title="Nenhum objetivo encontrado para este filtro"
        />
      ) : null}

      {!loading && !error && highlightedGoal ? (
        <Card className={`p-5 ${goalCardTone(highlightedGoal)}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Objetivo prioritário</p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--text)]">{highlightedGoal.name}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {goalTypeLabel(highlightedGoal.goal_type)} · {priorityLabel(highlightedGoal.priority)} ·{' '}
                {statusLabel(highlightedGoal.status)} · {ownerModeLabel(highlightedGoal.owner_mode)}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button icon={<Wallet size={16} />} onClick={() => openContribution(highlightedGoal)} variant="secondary">
                Registrar aporte
              </Button>
              <Button icon={<Edit3 size={16} />} onClick={() => openEdit(highlightedGoal)} variant="ghost">
                Editar
              </Button>
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar
              label={`${formatPercent(highlightedGoal.progress_percentage)} concluído · ${formatCurrency(
                highlightedGoal.monthly_savings_needed,
              )} por mês`}
              value={highlightedGoal.progress_percentage}
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-[var(--surface-strong)] p-3">
              <p className="text-xs text-[var(--muted)]">Valor guardado</p>
              <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(highlightedGoal.current_amount)}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-strong)] p-3">
              <p className="text-xs text-[var(--muted)]">Valor faltante</p>
              <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(highlightedGoal.remaining_amount)}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-strong)] p-3">
              <p className="text-xs text-[var(--muted)]">Prazo</p>
              <p className="font-semibold text-[var(--text)]">{formatDate(goalTargetDate(highlightedGoal))}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-strong)] p-3">
              <p className="text-xs text-[var(--muted)]">Aportes</p>
              <p className="font-semibold text-[var(--text)]">{highlightedGoal.contribution_count}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && !error && filteredGoals.length > 0 ? (
        <div className="grid gap-4">
          {filteredGoals.map((goal) => {
            const isTravel = goal.goal_type === 'travel'

            return (
              <Card className={`p-5 ${goalCardTone(goal)}`} key={goal.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--text)]">{goal.name}</h3>
                      {isTravel ? (
                        <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs text-sky-200">
                          <span className="inline-flex items-center gap-1">
                            <Plane size={12} /> Viagem
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                      <Calendar size={15} /> {formatDate(goalTargetDate(goal))}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {priorityLabel(goal.priority)} · {statusLabel(goal.status)} · {ownerModeLabel(goal.owner_mode)}
                    </p>
                    {goal.owner_mode === 'shared' && goal.participants?.length ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Compartilhado com: {goal.participants.map((participant) => participant.profile_name).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:flex">
                    <Button icon={<Wallet size={16} />} onClick={() => openContribution(goal)} size="sm" variant="secondary">
                      Aporte
                    </Button>
                    <Button icon={<Plus size={16} />} onClick={() => openBudget(goal)} size="sm" variant="ghost">
                      Orçamento
                    </Button>
                    <Button icon={<Edit3 size={16} />} onClick={() => openEdit(goal)} size="icon" variant="ghost" />
                    <Button icon={<Trash2 size={16} />} onClick={() => void deleteGoal(goal)} size="icon" variant="ghost" />
                  </div>
                </div>

                <div className="mt-5">
                  <ProgressBar label={`${formatPercent(goal.progress_percentage)} concluído`} value={goal.progress_percentage} />
                </div>

                {isTravel ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Valor planejado</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">
                        {formatCurrency(goal.planned_budget_total || goal.target_amount)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Reservado nos itens</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.allocated_budget_total)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Valor já gasto</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.linked_spending_total)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Falta reservar</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.budget_remaining_total)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Aporte mensal</p>
                      <p className="number-tabular font-semibold text-[var(--accent)]">{formatCurrency(goal.monthly_savings_needed)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Progresso</p>
                      <p className="font-semibold text-[var(--text)]">{formatPercent(goal.progress_percentage)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Meta</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.target_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Falta</p>
                      <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.remaining_amount)}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                      <p className="text-xs text-[var(--muted)]">Por mês</p>
                      <p className="number-tabular font-semibold text-[var(--accent)]">{formatCurrency(goal.monthly_savings_needed)}</p>
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">Aportes recentes</p>
                        <p className="text-xs text-[var(--muted)]">Linha do tempo compacta para acompanhar o ritmo da meta.</p>
                      </div>
                    </div>
                    {goal.latest_contributions.length ? (
                      <div className="mt-4 grid gap-3">
                        {goal.latest_contributions.map((contribution) => (
                          <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--surface-strong)] p-3" key={contribution.id}>
                            <div>
                              <p className="font-medium text-[var(--text)]">{formatCurrency(contribution.amount)}</p>
                              <p className="text-xs text-[var(--muted)]">
                                {formatDate(contribution.contribution_date)}
                                {contribution.source ? ` · ${contribution.source}` : ''}
                              </p>
                              {contribution.notes ? <p className="mt-1 text-xs text-[var(--muted)]">{contribution.notes}</p> : null}
                            </div>
                            <Button
                              icon={<Trash2 size={14} />}
                              onClick={() => void deleteContribution(contribution.id)}
                              size="icon"
                              variant="ghost"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[var(--muted)]">Ainda não há aportes registrados.</p>
                    )}
                    {goal.contributions_by_profile.length ? (
                      <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4">
                        <p className="text-xs font-medium text-[var(--muted)]">Contribuicoes por pessoa</p>
                        {goal.contributions_by_profile.map((entry) => (
                          <div className="flex items-center justify-between text-sm" key={entry.profile_id}>
                            <span className="text-[var(--muted)]">{entry.profile_name}</span>
                            <span className="number-tabular font-medium text-[var(--text)]">{formatCurrency(entry.total)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {goal.recent_allocations.length ? (
                      <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4">
                        <p className="text-xs font-medium text-[var(--muted)]">Distribuicoes recentes</p>
                        {goal.recent_allocations.slice(0, 4).map((allocation) => (
                          <p className="text-xs text-[var(--muted)]" key={allocation.id}>
                            {formatCurrency(allocation.amount)} para {allocation.budget_item_name} via{' '}
                            {allocation.source_type === 'transaction' ? 'transacao' : 'aporte'}
                            {allocation.source_label ? ` · ${allocation.source_label}` : ''}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">Orçamento do objetivo</p>
                        <p className="text-xs text-[var(--muted)]">Planejado x realizado por item.</p>
                      </div>
                      {goal.planned_budget_total > 0 && Math.abs(goal.target_amount - goal.planned_budget_total) > 0.01 ? (
                        <Button onClick={() => void applyBudgetAsTarget(goal)} size="sm" variant="ghost">
                          Usar total como meta
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                        <p className="text-xs text-[var(--muted)]">Planejado</p>
                        <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.planned_budget_total)}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                        <p className="text-xs text-[var(--muted)]">Realizado</p>
                        <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(goal.actual_budget_total)}</p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-strong)] p-3">
                        <p className="text-xs text-[var(--muted)]">Diferença</p>
                        <p className="number-tabular font-semibold text-[var(--text)]">
                          {formatCurrency(goal.planned_budget_total - goal.actual_budget_total)}
                        </p>
                      </div>
                    </div>
                    {goal.budget_items.length ? (
                      <div className="mt-4 grid gap-3">
                        {goal.budget_items.map((item) => (
                          <div className="rounded-xl bg-[var(--surface-strong)] p-3" key={item.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-[var(--text)]">{item.name}</p>
                                <p className="text-xs text-[var(--muted)]">{item.category}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button icon={<Edit3 size={14} />} onClick={() => openBudget(goal, item)} size="icon" variant="ghost" />
                                <Button icon={<Trash2 size={14} />} onClick={() => void deleteBudgetItem(item.id)} size="icon" variant="ghost" />
                              </div>
                            </div>
                            <div className="mt-3">
                              <ProgressBar
                                label={`Reservado: ${formatCurrency(item.allocated_amount)} de ${formatCurrency(item.planned_amount)}`}
                                value={item.allocation_percentage}
                              />
                              <p className="mt-2 text-xs text-[var(--muted)]">
                                Planejado: {formatCurrency(item.planned_amount)} · Reservado: {formatCurrency(item.allocated_amount)} · Gasto:{' '}
                                {formatCurrency(item.actual_amount)} · Falta reservar: {formatCurrency(item.remaining_amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[var(--muted)]">Nenhum item de orçamento criado ainda.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-[var(--accent)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">Transações vinculadas</p>
                      <p className="text-xs text-[var(--muted)]">
                        Total gasto vinculado: {formatCurrency(goal.linked_spending_total)}
                      </p>
                    </div>
                  </div>
                  {goal.linked_transactions.length ? (
                    <div className="mt-4 grid gap-3">
                      {goal.linked_transactions.map((link) => (
                        <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--surface-strong)] p-3" key={link.id}>
                          <div>
                            <p className="font-medium text-[var(--text)]">
                              {link.transaction_merchant_name || link.transaction_description}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {formatDate(link.transaction_posted_at)} · {link.transaction_effective_category}
                              {link.budget_item_name ? ` · ${link.budget_item_name}` : ''}
                            </p>
                            {link.notes ? <p className="mt-1 text-xs text-[var(--muted)]">{link.notes}</p> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="number-tabular text-sm font-semibold text-[var(--text)]">
                              {formatCurrency(link.transaction_amount)}
                            </p>
                            <Button
                              icon={<Trash2 size={14} />}
                              onClick={() => void unlinkTransaction(link.id)}
                              size="icon"
                              variant="ghost"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">Use a tela de transações para vincular gastos a este objetivo.</p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}

      <FilterSheet
        onApply={() => setFiltersOpen(false)}
        onClear={() => {
          setStatusFilter('all')
          setTypeFilter('all')
          setPriorityFilter('all')
          setFiltersOpen(false)
        }}
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      >
        <Select
          label="Status"
          onChange={(event) => setStatusFilter(event.target.value as 'all' | GoalStatus)}
          options={[{ label: 'Todos', value: 'all' }, ...statusOptions]}
          value={statusFilter}
        />
        <Select
          label="Tipo"
          onChange={(event) => setTypeFilter(event.target.value as 'all' | GoalType)}
          options={[{ label: 'Todos', value: 'all' }, ...goalTypeOptions]}
          value={typeFilter}
        />
        <Select
          label="Prioridade"
          onChange={(event) => setPriorityFilter(event.target.value as 'all' | GoalPriority)}
          options={[{ label: 'Todas', value: 'all' }, ...priorityOptions]}
          value={priorityFilter}
        />
      </FilterSheet>

      <Modal
        description="Defina tipo, prioridade, prazo e, se quiser, já comece um orçamento interno para o objetivo."
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'Editar objetivo' : 'Novo objetivo'}
      >
        <form className="grid gap-4" onSubmit={saveGoal}>
          <Input label="Nome" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Valor da meta"
              min="0"
              onChange={(event) => setForm({ ...form, targetAmount: event.target.value })}
              step="0.01"
              type="number"
              value={form.targetAmount}
            />
            <Input
              label="Valor guardado"
              min="0"
              onChange={(event) => setForm({ ...form, currentAmount: event.target.value })}
              step="0.01"
              type="number"
              value={form.currentAmount}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Data alvo"
              onChange={(event) => setForm({ ...form, targetDate: event.target.value })}
              type="date"
              value={form.targetDate}
            />
            <Select
              label="Tipo do objetivo"
              onChange={(event) => setForm({ ...form, goalType: event.target.value as GoalType })}
              options={goalTypeOptions}
              value={form.goalType}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Prioridade"
              onChange={(event) => setForm({ ...form, priority: event.target.value as GoalPriority })}
              options={priorityOptions}
              value={form.priority}
            />
            <Select
              label="Status"
              onChange={(event) => setForm({ ...form, status: event.target.value as GoalStatus })}
              options={statusOptions}
              value={form.status}
            />
            <Select
              label="Titularidade"
              onChange={(event) => {
                const ownerMode = event.target.value as GoalOwnerMode
                setForm({
                  ...form,
                  ownerMode,
                  participantProfileIds:
                    ownerMode === 'shared'
                      ? Array.from(new Set([profile.id, ...profiles.map((item) => item.id)]))
                      : [profile.id],
                })
              }}
              options={ownerOptions}
              value={form.ownerMode}
            />
          </div>
          {form.ownerMode === 'shared' ? (
            <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-3">
              <p className="text-sm font-medium text-[var(--text)]">Participantes</p>
              {profiles.map((item) => (
                <label className="flex items-center gap-3 text-sm text-[var(--muted)]" key={item.id}>
                  <input
                    checked={form.participantProfileIds.includes(item.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                    disabled={item.id === profile.id}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? Array.from(new Set([...form.participantProfileIds, item.id]))
                        : form.participantProfileIds.filter((id) => id !== item.id)
                      setForm({ ...form, participantProfileIds: next.includes(profile.id) ? next : [profile.id, ...next] })
                    }}
                    type="checkbox"
                  />
                  Compartilhar com {item.name}
                </label>
              ))}
            </div>
          ) : null}
          {form.goalType === 'travel' && !editing ? (
            <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <input
                checked={form.createDefaultBudgetItems}
                className="h-4 w-4 accent-[var(--accent)]"
                onChange={(event) => setForm({ ...form, createDefaultBudgetItems: event.target.checked })}
                type="checkbox"
              />
              Criar itens sugeridos para viagem
            </label>
          ) : null}
          <Textarea label="Observações" onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar objetivo'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        description={contributionGoal ? `Registre a origem e a data do aporte para ${contributionGoal.name}.` : 'Registre um aporte.'}
        onClose={() => setContributionModalOpen(false)}
        open={contributionModalOpen}
        title={contributionGoal ? `Adicionar valor em ${contributionGoal.name}` : 'Adicionar valor'}
      >
        <form className="grid gap-4" onSubmit={addContribution}>
          <Input
            label="Valor"
            min="0"
            onChange={(event) => setContributionForm({ ...contributionForm, amount: event.target.value })}
            step="0.01"
            type="number"
            value={contributionForm.amount}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Data do aporte"
              onChange={(event) => setContributionForm({ ...contributionForm, contributionDate: event.target.value })}
              type="date"
              value={contributionForm.contributionDate}
            />
            <Input
              label="Origem"
              onChange={(event) => setContributionForm({ ...contributionForm, source: event.target.value })}
              placeholder="Ex.: salário, bônus, transferência"
              value={contributionForm.source}
            />
          </div>
          <Textarea
            label="Observação"
            onChange={(event) => setContributionForm({ ...contributionForm, notes: event.target.value })}
            value={contributionForm.notes}
          />
          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <input
              checked={contributionForm.autoAllocate}
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={(event) => setContributionForm({ ...contributionForm, autoAllocate: event.target.checked })}
              type="checkbox"
            />
            Distribuir automaticamente entre itens do objetivo
          </label>
          {contributionForm.autoAllocate ? (
            <Select
              label="Estrategia de distribuicao"
              onChange={(event) =>
                setContributionForm({
                  ...contributionForm,
                  allocationStrategy: event.target.value as 'largest_first' | 'smallest_first' | 'manual_order',
                })
              }
              options={[
                { label: 'Priorizar maiores itens primeiro', value: 'largest_first' },
                { label: 'Priorizar menores itens primeiro', value: 'smallest_first' },
                { label: 'Ordem manual', value: 'manual_order' },
              ]}
              value={contributionForm.allocationStrategy}
            />
          ) : null}
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setContributionModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Registrando...' : 'Registrar aporte'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        description={budgetGoal ? `Monte ou ajuste o orçamento interno de ${budgetGoal.name}.` : 'Configure um item de orçamento.'}
        onClose={() => setBudgetModalOpen(false)}
        open={budgetModalOpen}
        title={editingBudgetItem ? 'Editar item do orçamento' : 'Novo item do orçamento'}
      >
        <form className="grid gap-4" onSubmit={saveBudgetItem}>
          <Input label="Nome do item" onChange={(event) => setBudgetForm({ ...budgetForm, name: event.target.value })} value={budgetForm.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Categoria"
              onChange={(event) => setBudgetForm({ ...budgetForm, category: event.target.value })}
              placeholder="Ex.: Passagens"
              value={budgetForm.category}
            />
            <Input
              label="Valor planejado"
              min="0"
              onChange={(event) => setBudgetForm({ ...budgetForm, plannedAmount: event.target.value })}
              step="0.01"
              type="number"
              value={budgetForm.plannedAmount}
            />
          </div>
          <Textarea label="Observações" onChange={(event) => setBudgetForm({ ...budgetForm, notes: event.target.value })} value={budgetForm.notes} />
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setBudgetModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar item'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
