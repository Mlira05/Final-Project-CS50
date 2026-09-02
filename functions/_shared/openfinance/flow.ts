// CS50 Final Project — functions/_shared/openfinance/flow.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { normalizeComparableText } from "../category-normalizer";

export type OpenFinanceFlowType =
  | "expense"
  | "income"
  | "transfer"
  | "investment"
  | "refund"
  | "card_payment"
  | "other";

const incomeCategoryTerms = [
  "renda",
  "salario",
  "salário",
  "pro labore",
  "pro-labore",
  "recebimento",
  "recebimentos",
  "rendimento",
  "rendimentos",
  "bonus",
  "bônus",
  "bonificacao",
  "bonificação",
  "comissao",
  "comissão",
  "dividendo",
  "dividendos",
];

const transferCategoryTerms = [
  "transferencia",
  "transferência",
  "transferencias",
  "transferências",
  "pix",
  "ted",
  "doc",
];

const investmentCategoryTerms = [
  "investimento",
  "investimentos",
  "aporte",
  "aplicacao",
  "aplicação",
  "corretora",
  "tesouro",
  "cdb",
];

const refundCategoryTerms = ["estorno", "estornos", "reembolso", "chargeback"];

const cardPaymentCategoryTerms = [
  "pagamento de fatura",
  "pagamento fatura",
  "fatura cartao",
  "fatura cartão",
  "pagamento cartao",
  "pagamento cartão",
];

function normalizedTerms(terms: string[]) {
  return terms.map((term) => normalizeComparableText(term)).filter(Boolean);
}

const normalizedIncomeTerms = normalizedTerms(incomeCategoryTerms);
const normalizedTransferTerms = normalizedTerms(transferCategoryTerms);
const normalizedInvestmentTerms = normalizedTerms(investmentCategoryTerms);
const normalizedRefundTerms = normalizedTerms(refundCategoryTerms);
const normalizedCardPaymentTerms = normalizedTerms(cardPaymentCategoryTerms);

function includesAnyTerm(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function categoryDrivenOpenFinanceFlow(category: string | null | undefined): OpenFinanceFlowType | null {
  const comparable = normalizeComparableText(category);
  if (!comparable || comparable === "sem categoria") {
    return null;
  }

  if (includesAnyTerm(comparable, normalizedRefundTerms)) {
    return "refund";
  }

  if (includesAnyTerm(comparable, normalizedCardPaymentTerms)) {
    return "card_payment";
  }

  if (includesAnyTerm(comparable, normalizedInvestmentTerms)) {
    return "investment";
  }

  if (includesAnyTerm(comparable, normalizedTransferTerms)) {
    return "transfer";
  }

  if (includesAnyTerm(comparable, normalizedIncomeTerms)) {
    return "income";
  }

  return null;
}

export function openFinanceFlowFromTransactionKind(transactionKind: string | null | undefined): OpenFinanceFlowType {
  switch (normalizeComparableText(transactionKind)) {
    case "bank_income":
      return "income";
    case "bank_expense":
    case "credit_card_expense":
      return "expense";
    case "refund":
      return "refund";
    case "card_payment":
      return "card_payment";
    case "investment_transfer":
      return "investment";
    case "transfer":
      return "transfer";
    default:
      return "other";
  }
}

export function resolveOpenFinanceFlow(input: {
  effectiveCategory?: string | null;
  transactionKind?: string | null;
}): OpenFinanceFlowType {
  return categoryDrivenOpenFinanceFlow(input.effectiveCategory) ?? openFinanceFlowFromTransactionKind(input.transactionKind);
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlContainsAnyTerm(columnSql: string, terms: string[]) {
  return terms.map((term) => `${columnSql} LIKE ${sqlString(`%${term.toLowerCase()}%`)}`).join(" OR ");
}

export function openFinanceEffectiveCategorySql(columns: {
  userCategorySql: string;
  originalCategorySql: string;
  systemCategorySql?: string | null;
}) {
  if (columns.systemCategorySql) {
    return `COALESCE(NULLIF(${columns.userCategorySql}, ''), NULLIF(${columns.systemCategorySql}, ''), NULLIF(${columns.originalCategorySql}, ''), 'Sem categoria')`;
  }

  return `COALESCE(NULLIF(${columns.userCategorySql}, ''), NULLIF(${columns.originalCategorySql}, ''), 'Sem categoria')`;
}

export function openFinanceFlowSql(columns: {
  userCategorySql: string;
  originalCategorySql: string;
  transactionKindSql: string;
  systemCategorySql?: string | null;
}) {
  const effectiveCategorySql = openFinanceEffectiveCategorySql(columns);
  const normalizedCategorySql = `LOWER(TRIM(${effectiveCategorySql}))`;

  return `CASE
    WHEN ${sqlContainsAnyTerm(normalizedCategorySql, refundCategoryTerms)} THEN 'refund'
    WHEN ${sqlContainsAnyTerm(normalizedCategorySql, cardPaymentCategoryTerms)} THEN 'card_payment'
    WHEN ${sqlContainsAnyTerm(normalizedCategorySql, investmentCategoryTerms)} THEN 'investment'
    WHEN ${sqlContainsAnyTerm(normalizedCategorySql, transferCategoryTerms)} THEN 'transfer'
    WHEN ${sqlContainsAnyTerm(normalizedCategorySql, incomeCategoryTerms)} THEN 'income'
    WHEN ${columns.transactionKindSql} = 'bank_income' THEN 'income'
    WHEN ${columns.transactionKindSql} IN ('bank_expense', 'credit_card_expense') THEN 'expense'
    WHEN ${columns.transactionKindSql} = 'refund' THEN 'refund'
    WHEN ${columns.transactionKindSql} = 'card_payment' THEN 'card_payment'
    WHEN ${columns.transactionKindSql} = 'investment_transfer' THEN 'investment'
    WHEN ${columns.transactionKindSql} = 'transfer' THEN 'transfer'
    ELSE 'other'
  END`;
}
