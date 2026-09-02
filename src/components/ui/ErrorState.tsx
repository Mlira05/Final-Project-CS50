// CS50 Final Project — src/components/ui/ErrorState.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { Button } from './Button'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="secondary">
          Tentar novamente
        </Button>
      ) : null}
    </div>
  )
}
