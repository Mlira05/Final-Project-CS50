// CS50 Final Project — src/components/ui/EmptyState.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { Card } from './Card'

interface EmptyStateProps {
  title: string
  message: string
  action?: ReactNode
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <Card className="p-8 text-center">
      <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  )
}

