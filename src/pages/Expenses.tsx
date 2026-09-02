// CS50 Final Project — src/pages/Expenses.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency, formatDate, todayInputValue } from '../lib/format'
import type { Category, Expense, Profile } from '../types/finance'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input, Textarea } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'

interface ExpensesProps {
  profile: Profile
  month: number
  year: number
  categories: Category[]
  dataVersion: number
  onDataChange: () => void
}

interface ExpenseForm {
  name: string
  category: string
  amount: string
  date: string
  paymentMethod: string
  isRecurring: boolean
  recurrenceEndDate: string
  notes: string
}

const paymentMethods = ['Pix', 'Cartão de débito', 'Cartão de crédito', 'Dinheiro', 'Transferência', 'Outro']

const emptyForm = (category = 'Outros'): ExpenseForm => ({
  name: '',
  category,
  amount: '',
  date: todayInputValue(),
  paymentMethod: 'Pix',
  isRecurring: false,
  recurrenceEndDate: `${new Date().getFullYear()}-12-31`,
  notes: '',
})

export function Expenses({ profile, month, year, categories, dataVersion, onDataChange }: ExpensesProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(() => emptyForm(categories[0]?.name))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.expenses(profile.id, month, year, categoryFilter, paymentFilter)
      setExpenses(response.expenses)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as despesas.')
    } finally {
      setLoading(false)
    }
  }, [profile.id, month, year, categoryFilter, paymentFilter])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm(categories[0]?.name))
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditing(expense)
    setForm({
      name: expense.name,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      paymentMethod: expense.payment_method,
      isRecurring: Boolean(expense.is_recurring),
      recurrenceEndDate: expense.recurrence_end_date ?? `${new Date(expense.date).getFullYear()}-12-31`,
      notes: expense.notes ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function saveExpense(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const amount = Number(form.amount)

    if (!form.name.trim()) {
      setFormError('Adicione um nome para a despesa.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('O valor da despesa precisa ser maior que zero.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        profileId: profile.id,
        name: form.name.trim(),
        category: form.category,
        amount,
        date: form.date,
        paymentMethod: form.paymentMethod,
        isRecurring: form.isRecurring,
        recurrenceEndDate: form.recurrenceEndDate,
        applyToFuture: true,
        notes: form.notes,
      }

      if (editing) {
        await api.updateExpense({ ...payload, id: editing.id })
      } else {
        await api.createExpense(payload)
      }

      setModalOpen(false)
      onDataChange()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar a despesa.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpense(expense: Expense) {
    const recurringText = expense.is_recurring ? ' Esta ação exclui esta despesa e as próximas da recorrência.' : ''
    if (!window.confirm(`Excluir "${expense.name}"?${recurringText}`)) {
      return
    }

    await api.deleteExpense(expense.id)
    onDataChange()
    await load()
  }

  const categoryOptions = categories.map((category) => ({ label: category.name, value: category.name }))
  const paymentOptions = paymentMethods.map((method) => ({ label: method, value: method }))

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">{profile.name}</p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">Despesas</h2>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Adicionar despesa
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Select
            label="Categoria"
            onChange={(event) => setCategoryFilter(event.target.value)}
            options={[{ label: 'Todas as categorias', value: 'all' }, ...categoryOptions]}
            value={categoryFilter}
          />
          <Select
            label="Forma de pagamento"
            onChange={(event) => setPaymentFilter(event.target.value)}
            options={[{ label: 'Todas as formas', value: 'all' }, ...paymentOptions]}
            value={paymentFilter}
          />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">Total do mês</p>
            <p className="number-tabular text-lg font-semibold text-[var(--text)]">{formatCurrency(total)}</p>
          </div>
        </div>
      </Card>

      {loading ? <LoadingState label="Carregando despesas" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && expenses.length === 0 ? (
        <EmptyState
          action={
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Adicionar despesa
            </Button>
          }
          message="Registre os gastos conforme acontecem e os gráficos serão atualizados automaticamente."
          title="Nenhuma despesa neste mês"
        />
      ) : null}

      {!loading && !error && expenses.length > 0 ? (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--surface-strong)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr className="border-t border-[var(--border)]" key={expense.id}>
                    <td className="px-4 py-3 text-[var(--text)]">{expense.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{expense.category}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{expense.payment_method}</td>
                    <td className="number-tabular px-4 py-3 text-right font-medium text-[var(--text)]">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button icon={<Edit3 size={16} />} onClick={() => openEdit(expense)} size="icon" variant="ghost" />
                        <Button
                          icon={<Trash2 size={16} />}
                          onClick={() => void deleteExpense(expense)}
                          size="icon"
                          variant="ghost"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-3 md:hidden">
            {expenses.map((expense) => (
              <Card className="p-4" key={expense.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">{expense.name}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {expense.category} · {formatDate(expense.date)} · {expense.payment_method}
                    </p>
                  </div>
                  <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(expense.amount)}</p>
                </div>
                <div className="mt-4 flex gap-2">
                    <Button icon={<Edit3 size={16} />} onClick={() => openEdit(expense)} size="sm" variant="secondary">
                    Editar
                  </Button>
                  <Button icon={<Trash2 size={16} />} onClick={() => void deleteExpense(expense)} size="sm" variant="ghost">
                    Excluir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <Button
        aria-label="Adicionar despesa"
        className="fixed bottom-24 right-4 z-40 rounded-full md:hidden"
        icon={<Plus size={22} />}
        onClick={openCreate}
        size="icon"
      />

      <Modal
        description="Cadastro rápido com categoria, forma de pagamento e recorrência mensal."
        onClose={() => setModalOpen(false)}
        open={modalOpen}
        title={editing ? 'Editar despesa' : 'Adicionar despesa'}
      >
        <form className="grid gap-4" onSubmit={saveExpense}>
          <Input label="Nome" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Valor"
              min="0"
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              step="0.01"
              type="number"
              value={form.amount}
            />
            <Input
              label="Data"
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              type="date"
              value={form.date}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Categoria"
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              options={categoryOptions}
              value={form.category}
            />
            <Select
              label="Forma de pagamento"
              onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
              options={paymentOptions}
              value={form.paymentMethod}
            />
          </div>
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
            <Input
              label="Repetir até"
              onChange={(event) => setForm({ ...form, recurrenceEndDate: event.target.value })}
              type="date"
              value={form.recurrenceEndDate}
            />
          ) : null}
          <Textarea label="Observações" onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar despesa'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
