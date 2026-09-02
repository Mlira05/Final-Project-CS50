// CS50 Final Project — functions/_shared/openfinance/dedupe.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export function normalizeDescription(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[|_/\\-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function amountToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface DedupeParts {
  ownerId: number;
  source: string;
  sourceAccountId: string;
  sourceBillId?: string | null;
  externalId?: string | null;
  transactionKind: string;
  postedAt: string;
  amountCents: number;
  description: string;
}

export async function buildDedupeKey(parts: DedupeParts) {
  if (parts.externalId) {
    return [
      parts.ownerId,
      parts.source,
      parts.sourceAccountId,
      parts.sourceBillId ?? "",
      parts.externalId,
    ].join(":");
  }

  return sha256Hex(
    [
      parts.ownerId,
      parts.source,
      parts.sourceAccountId,
      parts.sourceBillId ?? "",
      parts.transactionKind,
      parts.postedAt,
      parts.amountCents,
      normalizeDescription(parts.description),
    ].join("|"),
  );
}
