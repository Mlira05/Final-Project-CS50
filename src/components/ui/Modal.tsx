// CS50 Final Project — src/components/ui/Modal.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 py-3 backdrop-blur-sm sm:items-center">
      <section className="max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-[1.4rem] border border-[var(--border)] bg-[#080d1a]/95 p-4 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          <Button aria-label="Fechar modal" icon={<X size={18} />} onClick={onClose} size="icon" variant="ghost" />
        </div>
        {children}
      </section>
    </div>
  )
}
