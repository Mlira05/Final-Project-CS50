// CS50 Final Project — src/components/layout/LoginScreen.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useEffect, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { api } from '../../lib/api'
import type { AuthStatus, Profile } from '../../types/finance'
import { AppLogo } from '../brand/AppLogo'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

interface LoginScreenProps {
  status: AuthStatus | null
  onAuthenticated: () => void
}

export function LoginScreen({ status, onAuthenticated }: LoginScreenProps) {
  const [pin, setPin] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const locked = status?.mode === 'locked' || status?.configured === false
  const accessMode = status?.mode === 'access'

  useEffect(() => {
    void api
      .loginProfiles()
      .then((response) => {
        setProfiles(response.profiles)
        setSelectedProfileId(response.profiles[0]?.id ?? null)
      })
      .catch(() => {
        setProfiles([])
        setSelectedProfileId(null)
      })
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (status?.mode === 'profile' && !selectedProfileId) {
      setError('Selecione um perfil para continuar.')
      return
    }

    setLoading(true)

    try {
      await api.login(pin, selectedProfileId ?? undefined)
      onAuthenticated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden px-5 py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.22),transparent_28rem)]" />
      <Card className="relative w-full max-w-md overflow-hidden p-5 sm:p-7">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/60 to-transparent" />
        <div className="mb-7 grid justify-items-center text-center">
          <AppLogo size="lg" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text)]">Entrar</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Organize sua vida financeira com clareza</p>
        </div>

        {locked ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            Configure um APP_PIN no Cloudflare Pages ou proteja o projeto com Cloudflare Access.
          </div>
        ) : null}

        {accessMode && !status?.authenticated ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
            O Cloudflare Access está ativo. Abra o app pelo domínio protegido depois que seu e-mail for liberado.
          </div>
        ) : null}

        {!locked && (status?.mode === 'pin' || status?.mode === 'profile') ? (
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            {profiles.length ? (
              <div className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Perfil</span>
                <div className="grid grid-cols-2 gap-2">
                  {profiles.map((profile) => {
                    const selected = selectedProfileId === profile.id

                    return (
                      <button
                        className={`focus-ring flex items-center gap-2 rounded-[1rem] border px-3 py-2.5 text-left transition ${
                          selected
                            ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--text)]'
                            : 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        type="button"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface)] text-[var(--accent)]">
                          <UserRound size={17} />
                        </span>
                        <span className="min-w-0 truncate text-sm font-medium">{profile.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span>PIN</span>
              <span className="focus-within:border-[var(--accent-border)] flex h-11 items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 transition">
                <LockKeyhole className="text-[var(--accent)]" size={19} />
                <input
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                  minLength={1}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="Digite seu PIN"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                />
                <button
                  aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  className="text-[var(--muted)] transition hover:text-[var(--text)]"
                  onClick={() => setShowPin((current) => !current)}
                  type="button"
                >
                  {showPin ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <Button disabled={loading || !pin || (status?.mode === 'profile' && !selectedProfileId)} type="submit">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        ) : null}

        {accessMode && status?.authenticated ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Sessão validada pelo Cloudflare Access.
          </div>
        ) : null}

        <div className="mt-7 flex items-start gap-3 text-sm text-[var(--muted)]">
          <ShieldCheck className="mt-0.5 text-[var(--accent)]" size={18} />
          <p>Seus dados ficam protegidos e separados por perfil.</p>
        </div>
      </Card>
    </main>
  )
}
