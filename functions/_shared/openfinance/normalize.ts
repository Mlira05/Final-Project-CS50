// CS50 Final Project — functions/_shared/openfinance/normalize.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { amountToCents, buildDedupeKey } from "./dedupe.ts";

type RawRecord = Record<string, unknown>;

interface MoneyLike {
  amount?: unknown;
  currency?: unknown;
}

export interface NormalizedOpenFinanceTransaction {
  ownerId: number;
  source: "cumbuca";
  sourceType: "bank_account" | "credit_card";
  sourceAccountId: string;
  sourceBillId: string | null;
  externalId: string | null;
  dedupeKey: string;
  transactionKind:
    | "bank_expense"
    | "bank_income"
    | "credit_card_expense"
    | "refund"
    | "card_payment"
    | "investment_transfer"
    | "transfer";
  amountCents: number;
  currency: string;
  description: string;
  merchantName: string | null;
  originalCategory: string | null;
  postedAt: string;
  rawJson: string;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function money(value: unknown): MoneyLike {
  return record(value) as MoneyLike;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const result = text(value);
    if (result && result !== "NA") {
      return result;
    }
  }

  return "";
}

function datePart(value: string) {
  return value.includes("T") ? value.slice(0, 10) : value;
}

function isoDateTime(value: unknown, fallbackDate?: unknown) {
  const raw = firstText(value);
  if (raw) {
    return raw.includes("T") ? raw : `${raw}T00:00:00.000Z`;
  }

  const fallback = firstText(fallbackDate);
  return fallback ? `${fallback}T00:00:00.000Z` : new Date().toISOString();
}

function merchantFromDescription(description: string) {
  const parts = description
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? null;
}

function classifyBank(description: string, creditDebitType: string, sourceType: string) {
  const normalized = description.toLowerCase();
  if (creditDebitType === "CREDITO" && normalized.includes("estorno")) {
    return "refund";
  }

  if (creditDebitType === "CREDITO") {
    return "bank_income";
  }

  if (normalized.includes("pagamento de fatura")) {
    return "card_payment";
  }

  if (normalized.includes("aplicação") || normalized.includes("aplicacao") || sourceType.includes("APLIC")) {
    return "investment_transfer";
  }

  if (normalized.startsWith("transferência enviada") || normalized.startsWith("transferencia enviada")) {
    return "transfer";
  }

  return "bank_expense";
}

export async function normalizeBankTransaction(ownerId: number, accountId: string, raw: RawRecord) {
  const amount = money(raw.transactionAmount);
  const description = firstText(raw.transactionName, raw.type, "Transação bancária");
  const postedAt = isoDateTime(raw.transactionDateTime);
  const externalId = firstText(raw.transactionId) || null;
  const sourceType = firstText(raw.type);
  const transactionKind = classifyBank(description, firstText(raw.creditDebitType), sourceType);
  const amountCents = amountToCents(amount.amount);
  const originalCategory = firstText(raw.category, raw.transactionCategory, raw.type) || null;
  const merchantName = merchantFromDescription(description);

  const dedupeKey = await buildDedupeKey({
    ownerId,
    source: "cumbuca",
    sourceAccountId: accountId,
    externalId,
    transactionKind,
    postedAt,
    amountCents,
    description,
  });

  return {
    ownerId,
    source: "cumbuca",
    sourceType: "bank_account",
    sourceAccountId: accountId,
    sourceBillId: null,
    externalId,
    dedupeKey,
    transactionKind,
    amountCents,
    currency: firstText(amount.currency, "BRL"),
    description,
    merchantName,
    originalCategory,
    postedAt,
    rawJson: JSON.stringify(raw),
  } satisfies NormalizedOpenFinanceTransaction;
}

function classifyCreditCard(creditDebitType: string) {
  return creditDebitType === "CREDITO" ? "refund" : "credit_card_expense";
}

export async function normalizeCreditCardTransaction(
  ownerId: number,
  creditCardAccountId: string,
  billId: string,
  raw: RawRecord,
) {
  const amount = money(raw.brazilianAmount ?? raw.amount);
  const description = firstText(raw.transactionName, raw.transactionType, "Transação do cartão");
  const postedAt = isoDateTime(raw.transactionDateTime, raw.billPostDate);
  const externalId = firstText(raw.transactionId) || null;
  const transactionKind = classifyCreditCard(firstText(raw.creditDebitType));
  const amountCents = amountToCents(amount.amount);
  const mcc = raw.payeeMCC === undefined || raw.payeeMCC === null ? "" : `MCC ${String(raw.payeeMCC)}`;
  const originalCategory = firstText(raw.category, raw.transactionCategory, raw.transactionType, raw.paymentType, mcc) || null;

  const dedupeKey = await buildDedupeKey({
    ownerId,
    source: "cumbuca",
    sourceAccountId: creditCardAccountId,
    sourceBillId: billId,
    externalId,
    transactionKind,
    postedAt,
    amountCents,
    description,
  });

  return {
    ownerId,
    source: "cumbuca",
    sourceType: "credit_card",
    sourceAccountId: creditCardAccountId,
    sourceBillId: billId,
    externalId,
    dedupeKey,
    transactionKind,
    amountCents,
    currency: firstText(amount.currency, "BRL"),
    description,
    merchantName: merchantFromDescription(description),
    originalCategory,
    postedAt,
    rawJson: JSON.stringify(raw),
  } satisfies NormalizedOpenFinanceTransaction;
}

export function isInsideDateRange(postedAt: string, dateFrom: string, dateTo: string) {
  const postedDate = datePart(postedAt);
  return postedDate >= dateFrom && postedDate <= dateTo;
}

export function effectiveCategory(
  originalCategory: string | null,
  userCategory: string | null,
  systemCategory?: string | null,
) {
  return userCategory?.trim() || systemCategory?.trim() || originalCategory?.trim() || "Sem categoria";
}
