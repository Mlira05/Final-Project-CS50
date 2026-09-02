// CS50 Final Project — src/components/AtualizarDadosButton.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { OpenFinanceSyncResult, OpenFinanceSyncStateResponse, Profile } from '../types/finance'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface AtualizarDadosButtonProps {
  profile: Profile
  onSynced: () => void
  compact?: boolean
  disabled?: boolean
  disabledMessage?: string
}

export function AtualizarDadosButton({
  profile,
  onSynced,
  compact,
  disabled = false,
  disabledMessage,
}: AtualizarDadosButtonProps) {
  const [state, setState] = useState<OpenFinanceSyncStateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<OpenFinanceSyncResult | null>(null)

  const loadState = useCallback(async () => {
    try {
      const response = await api.openFinanceSyncState(profile.id)
      setState(response)
    } catch {
      setState(null)
    }
  }, [profile.id])

  useEffect(() => {
    void loadState()
  }, [loadState])

  async function sync() {
    if (disabled) {
      return
    }

    if (state?.connected === false) {
      setError('Configure uma conexão em Ajustes > Open Finance antes de atualizar.')
      return
    }

    setLoading(true)
    setError('')
    setMessage(state?.lastSuccessAt ? 'Atualizando dados...' : 'Importando dados de 2026 ate hoje...')
    setLastResult(null)

    try {
      const result = await api.syncOpenFinance(profile.id)
      setLastResult(result)
      setMessage('Dados atualizados com sucesso')
      await loadState()
      onSynced()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel atualizar os dados')
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Open Finance</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Atualizacao automatica</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {state?.lastSuccessAt ? `Ultima atualizacao: ${formatDateTime(state.lastSuccessAt)}` : 'Nenhuma atualizacao realizada ainda'}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {state?.activeConnection
              ? `Conexão própria do perfil: ${state.activeConnection.holder_name ?? profile.name}`
              : state?.usingLegacyGlobalConnection
                ? 'Usando conexão global legada do Cloudflare'
                : 'Perfil desconectado'}
          </p>
        </div>
        <Button
          className="min-w-[8.5rem] whitespace-nowrap rounded-full px-4"
          disabled={disabled || loading || state?.connected === false}
          icon={<RefreshCw size={16} />}
          onClick={() => void sync()}
        >
          {loading ? 'Atualizando dados...' : 'Atualizar dados'}
        </Button>
      </div>

      {disabled && disabledMessage ? (
        <p className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)]/50 px-3 py-2 text-sm text-[var(--text)]">
          {disabledMessage}
        </p>
      ) : null}
      {state?.connected === false ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Configure uma conexão em Ajustes &gt; Open Finance para ativar a importacao.
        </p>
      ) : null}
      {state?.usingLegacyGlobalConnection ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Esta atualização usa os secrets globais legados. Configure uma conexão própria do perfil quando possível.
        </p>
      ) : null}
      {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
      {lastResult ? (
        <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
          <span>Novas transacoes adicionadas: {lastResult.inserted}</span>
          <span>Transacoes ja existentes: {lastResult.skipped}</span>
          <span>Periodo: {lastResult.dateFrom} a {lastResult.dateTo}</span>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          Nao foi possivel atualizar os dados. {error}
        </p>
      ) : null}
    </Card>
  )
}
