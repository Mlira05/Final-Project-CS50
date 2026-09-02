// CS50 Final Project — src/pages/Reserve.tsx: Feature page and its user-interface state.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Edit3, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/format'
import type { Profile, ReserveEntry } from '../types/finance'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ChartCard } from '../components/ui/ChartCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input, Textarea } from '../components/ui/Input'
import { LoadingState } from '../components/ui/LoadingState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { StatCard } from '../components/ui/StatCard'

interface ReserveProps {
  profile: Profile
  dataVersion: number
  onDataChange: () => void
}

interface ReserveForm {
  name: string
  purpose: string
  amount: string
  notes: string
}

const purposeOptions = [
  { label: 'Reserva de emergência', value: 'Reserva de emergência' },
  { label: 'Investimento', value: 'Investimento' },
  { label: 'Meta específica', value: 'Meta específica' },
  { label: 'Outro', value: 'Outro' },
]

const purposeColors: Record<string, string> = {
  'Reserva de emergência': '#3b82f6',
  Investimento: '#22c55e',
  'Meta específica': '#8b5cf6',
  Outro: '#94a3b8',
}

const emptyForm: ReserveForm = {
  name: '',
  purpose: 'Reserva de emergência',
  amount: '',
  notes: '',
}

export function Reserve({ profile, dataVersion, onDataChange }: ReserveProps) {
  const [entries, setEntries] = useState<ReserveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReserveEntry | null>(null)
  const [form, setForm] = useState<ReserveForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await api.reserveEntries(profile.id)
      setEntries(response.entries)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os cofrinhos.')
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    void load()
  }, [load, dataVersion])

  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries])
  const distribution = useMemo(() => {
    const totals = new Map<string, number>()
    entries.forEach((entry) => totals.set(entry.purpose, (totals.get(entry.purpose) ?? 0) + entry.amount))

    return [...totals.entries()].map(([purpose, amount]) => ({
      purpose,
      amount,
      color: purposeColors[purpose] ?? '#94a3b8',
    }))
  }, [entries])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(entry: ReserveEntry) {
    setEditing(entry)
    setForm({
      name: entry.name,
      purpose: entry.purpose,
      amount: String(entry.amount),
      notes: entry.notes ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const amount = Number(form.amount)

    if (!form.name.trim()) {
      setFormError('Adicione um nome para o cofrinho.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('O valor precisa ser maior que zero.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        profileId: profile.id,
        name: form.name.trim(),
        purpose: form.purpose,
        amount,
        notes: form.notes,
      }

      if (editing) {
        await api.updateReserveEntry({ ...payload, id: editing.id })
      } else {
        await api.createReserveEntry(payload)
      }

      setModalOpen(false)
      onDataChange()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o cofrinho.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(entry: ReserveEntry) {
    if (!window.confirm(`Excluir "${entry.name}"?`)) {
      return
    }

    await api.deleteReserveEntry(entry.id)
    onDataChange()
    await load()
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">{profile.name}</p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">Cofrinhos</h2>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Adicionar cofrinho
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <StatCard label="Total nos cofrinhos" value={formatCurrency(total)} />
        <ChartCard title="Distribuição dos cofrinhos">
          {distribution.length ? (
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie data={distribution} dataKey="amount" innerRadius={62} nameKey="purpose" outerRadius={96} paddingAngle={3}>
                  {distribution.map((entry) => (
                    <Cell fill={entry.color} key={entry.purpose} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <h3 className="font-semibold text-[var(--text)]">Nenhum cofrinho ainda</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">Adicione um cofrinho para ver a distribuição.</p>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {loading ? <LoadingState label="Carregando cofrinhos" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && entries.length === 0 ? (
        <EmptyState
          action={
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Adicionar cofrinho
            </Button>
          }
          message="Acompanhe reservas, investimentos e valores guardados em um só lugar."
          title="Nenhum cofrinho cadastrado"
        />
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <Card className="p-4" key={entry.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">{entry.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{entry.purpose}</p>
                </div>
                <p className="number-tabular font-semibold text-[var(--text)]">{formatCurrency(entry.amount)}</p>
              </div>
              {entry.notes ? <p className="mt-3 text-sm text-[var(--muted)]">{entry.notes}</p> : null}
              <div className="mt-4 flex gap-2">
                <Button icon={<Edit3 size={16} />} onClick={() => openEdit(entry)} size="sm" variant="secondary">
                  Editar
                </Button>
                <Button icon={<Trash2 size={16} />} onClick={() => void deleteEntry(entry)} size="sm" variant="ghost">
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal onClose={() => setModalOpen(false)} open={modalOpen} title={editing ? 'Editar cofrinho' : 'Adicionar cofrinho'}>
        <form className="grid gap-4" onSubmit={saveEntry}>
          <Input label="Nome" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Finalidade"
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              options={purposeOptions}
              value={form.purpose}
            />
            <Input
              label="Valor"
              min="0"
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              step="0.01"
              type="number"
              value={form.amount}
            />
          </div>
          <Textarea label="Observações" onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
          {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
