// CS50 Final Project — src/components/ui/Card.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'glass-panel rounded-[1.2rem]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
