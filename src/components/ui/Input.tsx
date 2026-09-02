// CS50 Final Project — src/components/ui/Input.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="grid gap-2 text-sm text-[var(--muted)]" htmlFor={inputId}>
      <span>{label}</span>
      <input
        id={inputId}
        className={clsx(
          'focus-ring h-10 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--text)] transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  )
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label className="grid gap-2 text-sm text-[var(--muted)]" htmlFor={inputId}>
      <span>{label}</span>
      <textarea
        id={inputId}
        className={clsx(
          'focus-ring min-h-20 resize-y rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--text)] transition placeholder:text-[var(--muted)] focus:border-[var(--accent-border)]',
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  )
}
