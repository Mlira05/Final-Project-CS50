// CS50 Final Project — src/components/TransactionCategoryEditor.tsx: Reusable React user-interface component.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import type { Category, OpenFinanceTransaction } from '../types/finance'
import { Select } from './ui/Select'

interface TransactionCategoryEditorProps {
  transaction: OpenFinanceTransaction
  categories: Category[]
  onChange: (transactionId: number, category: string) => void
  disabled?: boolean
  pending?: boolean
}

export function TransactionCategoryEditor({
  transaction,
  categories,
  onChange,
  disabled,
  pending = false,
}: TransactionCategoryEditorProps) {
  const categoryOptions = [
    { label: 'Sem categoria', value: '' },
    ...categories.map((category) => ({ label: category.name, value: category.name })),
  ]
  const value = transaction.user_category ?? ''

  return (
    <div className="grid gap-1">
      <Select
        aria-label="Alterar categoria"
        disabled={disabled}
        id={`transaction-category-${transaction.id}`}
        label={pending ? 'Categoria pendente' : 'Alterar categoria'}
        onChange={(event) => onChange(transaction.id, event.target.value)}
        options={categoryOptions}
        value={value}
      />
      {pending ? <p className="text-xs text-[var(--accent)]">Alteracao pendente. Salve para aplicar.</p> : null}
      <p className="text-xs text-[var(--muted)]">
        Automatica: {transaction.system_category || 'Sem categoria'}
      </p>
      <p className="text-xs text-[var(--muted)]">
        Original: {transaction.original_category || 'Sem categoria'}
      </p>
    </div>
  )
}
