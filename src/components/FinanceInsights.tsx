// CS50 Final Project — src/components/FinanceInsights.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { Lightbulb } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import type { FinanceInsight } from '../types/finance'
import { Card } from './ui/Card'

interface FinanceInsightsProps {
  insights: FinanceInsight[]
}

export function FinanceInsights({ insights }: FinanceInsightsProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="text-[var(--accent)]">
          <Lightbulb size={18} />
        </span>
        <h3 className="text-lg font-semibold text-[var(--text)]">Onde você pode economizar</h3>
      </div>

      {insights.length ? (
        <div className="mt-4 grid gap-3">
          {insights.map((insight) => (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4" key={insight.title}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-[var(--text)]">{insight.title}</h4>
                  <p className="mt-1 text-sm text-[var(--muted)]">{insight.detail}</p>
                </div>
                <span className="number-tabular whitespace-nowrap text-sm font-semibold text-[var(--accent)]">
                  {formatCurrency(insight.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Ainda não há dados suficientes para uma análise confiável.</p>
      )}
    </Card>
  )
}
