// CS50 Final Project — src/components/ui/Select.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ label: string; value: string | number }>
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="grid gap-2 text-sm text-[var(--muted)]" htmlFor={inputId}>
      <span>{label}</span>
      <select
        id={inputId}
        className={clsx(
          'focus-ring h-10 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--text)] transition focus:border-[var(--accent-border)]',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  )
}
