// CS50 Final Project — src/components/ui/ChartCard.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { Card } from './Card'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      <div className="h-72 min-h-72">{children}</div>
    </Card>
  )
}
