// CS50 Final Project — src/pages/Income.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useState } from 'react'
import { Edit3, Landmark, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDateTime, monthNames } from '../lib/format'
import { openFinanceFlowLabel, openFinanceFlowToneClass } from '../lib/openFinanceFlow'
import type { MonthlyIncome, OpenFinanceTransaction, Profile } from '../types/finance'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input, Textarea } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { StatCard } from '../components/ui/StatCard'

interface IncomeProps {
  profile: Profile
  month: number
  year: number
  dataVersion: number
  onDataChange: () => void
}

interface IncomeForm {
  amount: string
  notes: string
  isRecurring: boolean
  recurrenceEndMonth: number
  recurrenceEndYear: number
}

function FlowBadge({ flow }: { flow: OpenFinanceTransaction['flow_type'] }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${openFinanceFlowToneClass(flow)}`}>
      {openFinanceFlowLabel(flow)}
    </span>
  )
}

export function Income({ profile, month, year, dataVersion, onDataChange }: IncomeProps) {
  const [income, setIncome] = useState<MonthlyIncome | null>(null)
  const [importedIncomeTransactions, setImportedIncomeTransactions] = useState<OpenFinanceTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<IncomeForm>({
    amount: '',
    notes: '',
    isRecurring: false,
    recurrenceEndMonth: 12,
    recurrenceEndYear: year,
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [incomeResponse, importedResponse] = await Promise.all([
        api.monthlyIncome(profile.id, month, year),
        api.transactions(profile.id, month, year, 'all', 'all', 'income'),
      ])

      setIncome(incomeResponse.income)
      setImportedIncomeTransactions(importedResponse.transactions)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar a renda.')
    } finally {
      setLoading(false)
    }
  }, [profile.id, month, year])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  const manualIncomeTotal = income?.amount ?? 0
  const importedIncomeTotal = importedIncomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const totalTrackedIncome = manualIncomeTotal + importedIncomeTotal

  function openForm() {
    setForm({
      amount: income ? String(income.amount) : '',
      notes: income?.notes ?? '',
      isRecurring: Boolean(income?.is_recurring),
      recurrenceEndMonth: income?.recurrence_end_month ?? 12,
      recurrenceEndYear: income?.recurrence_end_year ?? year,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function saveIncome(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const amount = Number(form.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('O valor da renda precisa ser maior que zero.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        profileId: profile.id,
        month,
        year,
        amount,
        notes: form.notes,
        isRecurring: form.isRecurring,
        recurrenceEndMonth: form.recurrenceEndMonth,
        recurrenceEndYear: form.recurrenceEndYear,
        applyToFuture: true,
      }

      if (income) {
        await api.updateMonthlyIncome({ ...payload, id: income.id })
      } else {
        await api.saveMonthlyIncome(payload)
      }

      setModalOpen(false)
      onDataChange()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Nao foi possivel salvar a renda.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteIncome() {
    const recurringText = income?.is_recurring ? ' Esta acao exclui esta renda e as proximas da recorrencia.' : ''
    if (!income || !window.confirm(`Excluir renda de ${monthNames[month - 1]} de ${year}?${recurringText}`)) {
      return
    }

    await api.deleteMonthlyIncome(income.id)
    onDataChange()
    await load()
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {profile.name} · {monthNames[month - 1]} {year}
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">Renda</h2>
        </div>
        <Button icon={income ? <Edit3 size={16} /> : <Plus size={16} />} onClick={openForm}>
          {income ? 'Editar renda manual' : 'Adicionar renda manual'}
        </Button>
      </div>

      {loading ? <LoadingState label="Carregando renda" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error ? (
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            detail={
              income
                ? income.is_recurring
                  ? `Recorrente ate ${monthNames[(income.recurrence_end_month ?? month) - 1]} de ${
                      income.recurrence_end_year ?? year
                    }`
                  : 'Lancamento manual unico'
                : 'Sem renda manual cadastrada'
            }
            icon={<Landmark size={18} />}
            label="Renda manual"
            value={formatCurrency(manualIncomeTotal)}
          />
          <StatCard
            detail={
              importedIncomeTransactions.length
                ? `${importedIncomeTransactions.length} entradas importadas neste mes`
                : 'Nenhuma entrada importada neste mes'
            }
            icon={<Landmark size={18} />}
            label="Entradas Open Finance"
            value={formatCurrency(importedIncomeTotal)}
          />
          <StatCard
            detail="Valor total conectado ao sistema"
            icon={<Landmark size={18} />}
            label="Renda total considerada"
            value={formatCurrency(totalTrackedIncome)}
          />
        </section>
      ) : null}

      {!loading && !error && income ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Renda manual</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{income.notes || 'Sem observacoes para esta renda.'}</p>
            </div>
            <Button icon={<Trash2 size={16} />} onClick={() => void deleteIncome()} variant="danger">
              Excluir
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && !income ? (
        <EmptyState
          action={
            <Button icon={<Plus size={16} />} onClick={openForm}>
              Adicionar renda manual
            </Button>
          }
          message="Cadastre aqui o valor manual planejado. As entradas importadas pelo Open Finance aparecem logo abaixo."
          title="Nenhuma renda manual cadastrada"
        />
      ) : null}

      {!loading && !error ? (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Entradas importadas</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Quando uma transacao for classificada como salario, renda ou outro tipo de entrada, ela passa a contar aqui e no Dashboard.
              </p>
            </div>
            <p className="number-tabular text-sm font-semibold text-[var(--accent)]">{formatCurrency(importedIncomeTotal)}</p>
          </div>

          {importedIncomeTransactions.length ? (
            <div className="mt-5 grid gap-3">
              {importedIncomeTransactions.slice(0, 12).map((transaction) => (
                <div
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4"
                  key={transaction.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text)]">{transaction.merchant_name || transaction.description}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{transaction.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <FlowBadge flow={transaction.flow_type} />
                        <span className="text-xs text-[var(--muted)]">{transaction.effective_category}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="number-tabular font-semibold text-emerald-300">{formatCurrency(transaction.amount)}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(transaction.posted_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
              Nenhuma entrada importada foi encontrada neste mes. Se alguma transacao deveria ser renda, ajuste a categoria na aba Transacoes.
            </div>
          )}
        </Card>
      ) : null}

      <Modal onClose={() => setModalOpen(false)} open={modalOpen} title={income ? 'Editar renda manual' : 'Adicionar renda manual'}>
        <form className="grid gap-4" onSubmit={saveIncome}>
          <Input
            label="Valor"
            min="0"
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            step="0.01"
            type="number"
            value={form.amount}
          />
          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <input
              checked={form.isRecurring}
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })}
              type="checkbox"
            />
            Repetir mensalmente
          </label>
          {form.isRecurring ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-[var(--muted)]">
                <span>Repetir ate o mes</span>
                <select
                  className="focus-ring h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-[var(--text)]"
                  onChange={(event) => setForm({ ...form, recurrenceEndMonth: Number(event.target.value) })}
                  value={form.recurrenceEndMonth}
                >
                  {monthNames.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Ano final"
                onChange={(event) => setForm({ ...form, recurrenceEndYear: Number(event.target.value) })}
                type="number"
                value={form.recurrenceEndYear}
              />
            </div>
          ) : null}
          <Textarea
            label="Observacoes"
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            value={form.notes}
          />
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar renda'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
