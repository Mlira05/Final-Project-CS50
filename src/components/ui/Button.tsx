// CS50 Final Project — src/components/ui/Button.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'border-violet-300/30 bg-gradient-to-r from-violet-500 to-violet-700 text-white shadow-[0_14px_34px_rgba(139,92,246,0.32)] hover:brightness-110',
  secondary:
    'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)]',
  ghost: 'bg-transparent text-[var(--muted-strong)] hover:bg-[var(--accent-soft)] border-transparent',
  danger: 'border-red-500/30 bg-red-500/12 text-red-300 hover:bg-red-500/20',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  icon,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-[1rem] border font-medium transition duration-200 disabled:opacity-50',
        sizeClass[size],
        variantClass[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
