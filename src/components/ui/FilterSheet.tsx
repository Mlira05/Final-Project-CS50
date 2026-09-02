// CS50 Final Project — src/components/ui/FilterSheet.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from './Button'

interface FilterButtonProps {
  onClick: () => void
  activeCount?: number
  label?: string
}

interface FilterSheetProps {
  open: boolean
  title?: string
  children: ReactNode
  onApply: () => void
  onClear: () => void
  onClose: () => void
}

export function FilterButton({ onClick, activeCount = 0, label = 'Filtros' }: FilterButtonProps) {
  return (
    <button
      className="focus-ring relative inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-xs font-medium text-[var(--text)] shadow-sm transition hover:border-[var(--accent-border)]"
      onClick={onClick}
      type="button"
    >
      <SlidersHorizontal size={15} className="text-[var(--accent)]" />
      <span className="hidden min-[360px]:inline">{label}</span>
      {activeCount > 0 ? (
        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10px] leading-none text-white">
          {activeCount}
        </span>
      ) : null}
    </button>
  )
}

export function FilterSheet({ open, title = 'Filtros', children, onApply, onClear, onClose }: FilterSheetProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[1.4rem] border border-[var(--border)] bg-[#080d1a]/95 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">Ajuste a visualizacao</p>
            <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          </div>
          <Button aria-label="Fechar filtros" icon={<X size={17} />} onClick={onClose} size="icon" variant="ghost" />
        </div>
        <div className="grid gap-3">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={onClear} variant="secondary">
            Limpar
          </Button>
          <Button onClick={onApply}>Aplicar</Button>
        </div>
      </section>
    </div>
  )
}
