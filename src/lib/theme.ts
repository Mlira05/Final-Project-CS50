// CS50 Final Project — src/lib/theme.ts: Client-side domain or infrastructure helper.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { AccentOption } from '../types/finance'

export const accentOptions: AccentOption[] = [
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Lima', value: '#84cc16' },
  { label: 'Ciano', value: '#06b6d4' },
]

export const defaultAccent = accentOptions[0].value
