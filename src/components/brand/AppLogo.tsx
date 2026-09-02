// CS50 Final Project — src/components/brand/AppLogo.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import clsx from 'clsx'

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showWordmark?: boolean
  className?: string
}

const sizeClass = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-28 w-28',
}

export function AppLogo({ size = 'md', showWordmark = false, className }: AppLogoProps) {
  return (
    <div className={clsx('inline-flex items-center gap-3', className)}>
      <img
        alt="My Personal Finances"
        className={clsx(sizeClass[size], 'object-contain')}
        draggable={false}
        src="/brand/app-logo.png"
      />
      {showWordmark ? (
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-[var(--text)]">My Personal</span>
          <span className="block text-xs text-[var(--muted)]">Finances</span>
        </span>
      ) : null}
    </div>
  )
}
