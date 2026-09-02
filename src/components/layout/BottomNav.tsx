// CS50 Final Project — src/components/layout/BottomNav.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { Home, List, MoreHorizontal, Target } from 'lucide-react'
import type { AppTab } from '../../types/finance'

interface BottomNavProps {
  active: AppTab
  onChange: (tab: AppTab) => void
}

interface NavItem {
  id: AppTab
  label: string
  icon: ReactNode
}

const items: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', icon: <Home size={19} /> },
  { id: 'transactions', label: 'Transacoes', icon: <List size={19} /> },
  { id: 'goals', label: 'Metas', icon: <Target size={19} /> },
  { id: 'settings', label: 'Mais', icon: <MoreHorizontal size={19} /> },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[#050915]/90 px-4 pt-2 shadow-2xl backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 items-end gap-1">
        {items.map((item) => (
          <button
            className={`focus-ring grid min-h-[50px] justify-items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] transition ${
              active === item.id ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
            }`}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
