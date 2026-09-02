// CS50 Final Project — src/components/layout/AppHeader.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useState } from 'react'
import { Bell, Moon, Palette, Sun } from 'lucide-react'
import { monthNames } from '../../lib/format'
import { accentOptions } from '../../lib/theme'
import type { Profile, ThemeMode } from '../../types/finance'
import { AppLogo } from '../brand/AppLogo'
import { Button } from '../ui/Button'

interface AppHeaderProps {
  profiles: Profile[]
  selectedProfileId: number
  month: number
  year: number
  mode: ThemeMode
  accent: string
  onProfileChange: (profileId: number) => void
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
  onToggleTheme: () => void
  onAccentChange: (accent: string) => void
}

export function AppHeader({
  profiles,
  selectedProfileId,
  month,
  year,
  mode,
  accent,
  onProfileChange,
  onMonthChange,
  onYearChange,
  onToggleTheme,
  onAccentChange,
}: AppHeaderProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 3 + index)
  const [colorOpen, setColorOpen] = useState(false)
  const selectedAccent = accentOptions.find((option) => option.value === accent) ?? accentOptions[0]

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[#050915]/78 px-4 py-3 backdrop-blur-2xl lg:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <AppLogo size="sm" />
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Finanças pessoais</p>
            <h1 className="text-xl font-semibold text-[var(--text)]">Início</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <select
            aria-label="Perfil"
            className="focus-ring h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
            onChange={(event) => onProfileChange(Number(event.target.value))}
            value={selectedProfileId}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Mês"
            className="focus-ring h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
            onChange={(event) => onMonthChange(Number(event.target.value))}
            value={month}
          >
            {monthNames.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Ano"
            className="focus-ring h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
            onChange={(event) => onYearChange(Number(event.target.value))}
            value={year}
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <Button
            aria-label="Alternar tema claro e escuro"
            icon={mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            onClick={onToggleTheme}
            size="icon"
            variant="secondary"
          />

          <Button aria-label="Notificações" icon={<Bell size={18} />} size="icon" variant="secondary" />

          <div className="relative col-span-2 sm:col-span-1">
            <button
              aria-expanded={colorOpen}
              aria-label="Cor de destaque"
              className="focus-ring inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] sm:w-36"
              onClick={() => setColorOpen((open) => !open)}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <Palette size={16} />
                <span>{selectedAccent.label}</span>
              </span>
              <span className="h-3 w-3 rounded-full" style={{ background: selectedAccent.value }} />
            </button>
            {colorOpen ? (
              <div className="absolute right-0 top-12 z-50 grid w-full min-w-44 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl sm:w-44">
                {accentOptions.map((option) => (
                  <button
                    className={`focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      option.value === accent
                        ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]'
                    }`}
                    key={option.value}
                    onClick={() => {
                      onAccentChange(option.value)
                      setColorOpen(false)
                    }}
                    type="button"
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: option.value }} />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
