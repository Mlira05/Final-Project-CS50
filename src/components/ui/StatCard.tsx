// CS50 Final Project — src/components/ui/StatCard.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
  icon?: ReactNode
  detail?: string
}

const toneClass = {
  default: 'text-[var(--text)]',
  positive: 'text-[var(--success)]',
  negative: 'text-[var(--danger)]',
}

export function StatCard({ label, value, detail, icon, tone = 'default' }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{label}</p>
        {icon ? <span className="rounded-lg bg-[var(--accent-soft)] p-2 text-[var(--accent)]">{icon}</span> : null}
      </div>
      <p className={`number-tabular mt-3 text-2xl font-semibold tracking-normal ${toneClass[tone]}`}>{value}</p>
      {detail ? <p className="mt-2 text-xs text-[var(--muted)]">{detail}</p> : null}
    </Card>
  )
}
