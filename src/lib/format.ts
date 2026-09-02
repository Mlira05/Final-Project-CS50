// CS50 Final Project — src/lib/format.ts: Client-side domain or infrastructure helper.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value || 0)}%`
}

export function formatDate(value: string) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateTime(value: string) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function todayInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function currentMonthYear() {
  const today = new Date()

  return {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  }
}

export function nextYearDate() {
  const today = new Date()
  today.setFullYear(today.getFullYear() + 1)

  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
