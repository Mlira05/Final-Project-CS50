// CS50 Final Project — src/components/ui/ProgressBar.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
interface ProgressBarProps {
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, value))

  return (
    <div className="grid gap-2">
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${width}%` }} />
      </div>
      {label ? <p className="text-xs text-[var(--muted)]">{label}</p> : null}
    </div>
  )
}

