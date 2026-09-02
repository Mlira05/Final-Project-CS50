// CS50 Final Project — src/components/ui/Tabs.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import clsx from 'clsx'

interface TabItem<T extends string> {
  id: T
  label: string
  icon: ReactNode
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  active: T
  onChange: (tab: T) => void
  compact?: boolean
}

export function Tabs<T extends string>({ items, active, onChange, compact }: TabsProps<T>) {
  return (
    <nav className={clsx('grid gap-1', compact ? 'grid-flow-col auto-cols-fr overflow-x-auto' : '')}>
      {items.map((item) => (
        <button
          className={clsx(
            'focus-ring flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition',
            active === item.id
              ? 'bg-[var(--accent-soft)] text-[var(--text)] ring-1 ring-[var(--accent-border)]'
              : 'text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]',
            compact && 'justify-center px-2 py-2',
          )}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          <span className="text-[var(--accent)]">{item.icon}</span>
          {compact ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
        </button>
      ))}
    </nav>
  )
}
