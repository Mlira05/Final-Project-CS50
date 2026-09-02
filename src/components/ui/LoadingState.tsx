// CS50 Final Project — src/components/ui/LoadingState.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export function LoadingState({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid justify-items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-sm text-[var(--muted)]">{label}</p>
      </div>
    </div>
  )
}
