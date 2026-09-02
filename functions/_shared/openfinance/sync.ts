// CS50 Final Project — functions/_shared/openfinance/sync.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { CumbucaMcpClient } from "./cumbucaMcpClient.ts";
import { getDbFeatureFlags, type DbFeatureFlags } from "../db-schema";
import {
  getActiveOpenFinanceConnection,
  getOpenFinanceConnectionById,
  hasLegacyGlobalCumbucaCredentials,
  loadDecryptedCumbucaCredentials,
} from "./connections";
import { normalizeSystemCategoryForTransaction, listActiveCategoryRules } from "./categorization.ts";
import {
  isInsideDateRange,
  normalizeBankTransaction,
  normalizeCreditCardTransaction,
  type NormalizedOpenFinanceTransaction,
} from "./normalize.ts";
import type {
  Env,
  OpenFinanceSyncJobRow,
  OpenFinanceSyncStateRow,
  OpenFinanceTransactionRow,
} from "../types";

const provider = "cumbuca";
const firstImportDate = "2026-01-01";
const lockMinutes = 10;

type RawRecord = Record<string, unknown>;

interface ListAccountsResponse {
  accounts?: RawRecord[];
}

interface ListCreditCardsResponse {
  credit_cards?: RawRecord[];
}

interface ListTransactionsResponse {
  transactions?: RawRecord[];
}

interface ListBillsResponse {
  bills?: RawRecord[];
}

function todaySaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function subtractDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function shouldFetchBill(dueDate: unknown, dateFrom: string, dateTo: string) {
  if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return true;
  }

  return dueDate >= dateFrom && dueDate <= addDays(dateTo, 45);
}

function isFreshRunningState(state: OpenFinanceSyncStateRow | null) {
  if (!state?.last_sync_started_at || state.status !== "running") {
    return false;
  }

  const startedAt = Date.parse(state.last_sync_started_at);
  return Number.isFinite(startedAt) && Date.now() - startedAt < lockMinutes * 60 * 1000;
}

function hasBaseOpenFinanceSchema(schema: DbFeatureFlags) {
  return schema.hasOpenFinanceTransactions && schema.hasOpenFinanceSyncState && schema.hasOpenFinanceSyncJobs;
}

async function ensureSyncState(db: D1Database, ownerId: number, connectionId: number | null, schema: DbFeatureFlags) {
  if (schema.hasOpenFinanceSyncStateConnectionId) {
    await db
      .prepare(
        `INSERT INTO open_finance_sync_state (owner_id, provider, connection_id, status)
         VALUES (?, ?, ?, 'idle')
         ON CONFLICT(owner_id, provider) DO NOTHING`,
      )
      .bind(ownerId, provider, connectionId)
      .run();

    await db
      .prepare(
        `UPDATE open_finance_sync_state
         SET connection_id = ?
         WHERE owner_id = ? AND provider = ?`,
      )
      .bind(connectionId, ownerId, provider)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO open_finance_sync_state (owner_id, provider, status)
         VALUES (?, ?, 'idle')
         ON CONFLICT(owner_id, provider) DO NOTHING`,
      )
      .bind(ownerId, provider)
      .run();
  }

  return db
    .prepare("SELECT * FROM open_finance_sync_state WHERE owner_id = ? AND provider = ?")
    .bind(ownerId, provider)
    .first<OpenFinanceSyncStateRow>();
}

async function createJob(
  db: D1Database,
  ownerId: number,
  connectionId: number | null,
  dateFrom: string,
  dateTo: string,
  startedAt: string,
  schema: DbFeatureFlags,
) {
  if (!schema.hasOpenFinanceSyncJobsConnectionId) {
    return db
      .prepare(
        `INSERT INTO open_finance_sync_jobs (owner_id, provider, status, date_from, date_to, started_at)
         VALUES (?, ?, 'running', ?, ?, ?)
         RETURNING *`,
      )
      .bind(ownerId, provider, dateFrom, dateTo, startedAt)
      .first<OpenFinanceSyncJobRow>();
  }

  return db
    .prepare(
      `INSERT INTO open_finance_sync_jobs (owner_id, connection_id, provider, status, date_from, date_to, started_at)
       VALUES (?, ?, ?, 'running', ?, ?, ?)
       RETURNING *`,
    )
    .bind(ownerId, connectionId, provider, dateFrom, dateTo, startedAt)
    .first<OpenFinanceSyncJobRow>();
}

async function markStateRunning(db: D1Database, ownerId: number, startedAt: string, isInitialImport: boolean) {
  await db
    .prepare(
      `UPDATE open_finance_sync_state
       SET status = 'running',
           last_sync_started_at = ?,
           first_import_started_at = CASE WHEN ? THEN COALESCE(first_import_started_at, ?) ELSE first_import_started_at END,
           last_error = NULL
       WHERE owner_id = ? AND provider = ?`,
    )
    .bind(startedAt, isInitialImport ? 1 : 0, startedAt, ownerId, provider)
    .run();
}

async function markSuccess(
  db: D1Database,
  ownerId: number,
  connectionId: number | null,
  jobId: number,
  inserted: number,
  skipped: number,
  updated: number,
  finishedAt: string,
  schema: DbFeatureFlags,
) {
  await db
    .prepare(
      `UPDATE open_finance_sync_jobs
       SET status = 'succeeded', inserted_count = ?, skipped_count = ?, updated_count = ?, finished_at = ?
       WHERE id = ?`,
    )
    .bind(inserted, skipped, updated, finishedAt, jobId)
    .run();

  if (schema.hasOpenFinanceSyncStateConnectionId) {
    await db
      .prepare(
        `UPDATE open_finance_sync_state
         SET status = 'succeeded', connection_id = ?, last_success_at = ?, last_error = NULL
         WHERE owner_id = ? AND provider = ?`,
      )
      .bind(connectionId, finishedAt, ownerId, provider)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE open_finance_sync_state
         SET status = 'succeeded', last_success_at = ?, last_error = NULL
         WHERE owner_id = ? AND provider = ?`,
      )
      .bind(finishedAt, ownerId, provider)
      .run();
  }

  if (connectionId && schema.hasOpenFinanceConnections) {
    await db
      .prepare(
        `UPDATE open_finance_connections
         SET last_success_at = ?, last_error = NULL, consent_status = CASE WHEN consent_status = 'unknown' THEN 'active' ELSE consent_status END
         WHERE id = ?`,
      )
      .bind(finishedAt, connectionId)
      .run();
  }
}

async function markFailure(
  db: D1Database,
  ownerId: number,
  connectionId: number | null,
  jobId: number | null,
  errorMessage: string,
  finishedAt: string,
  schema: DbFeatureFlags,
) {
  if (jobId) {
    await db
      .prepare(
        `UPDATE open_finance_sync_jobs
         SET status = 'failed', error_message = ?, finished_at = ?
         WHERE id = ?`,
      )
      .bind(errorMessage, finishedAt, jobId)
      .run();
  }

  if (schema.hasOpenFinanceSyncStateConnectionId) {
    await db
      .prepare(
        `UPDATE open_finance_sync_state
         SET status = 'failed', connection_id = ?, last_error = ?
         WHERE owner_id = ? AND provider = ?`,
      )
      .bind(connectionId, errorMessage, ownerId, provider)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE open_finance_sync_state
         SET status = 'failed', last_error = ?
         WHERE owner_id = ? AND provider = ?`,
      )
      .bind(errorMessage, ownerId, provider)
      .run();
  }

  if (connectionId && schema.hasOpenFinanceConnections) {
    await db.prepare("UPDATE open_finance_connections SET last_error = ? WHERE id = ?").bind(errorMessage, connectionId).run();
  }
}

async function upsertTransaction(
  db: D1Database,
  transaction: NormalizedOpenFinanceTransaction,
  rules: Awaited<ReturnType<typeof listActiveCategoryRules>>,
  schema: DbFeatureFlags,
  connectionId: number | null,
) {
  const existing = await db
    .prepare(
      `SELECT id${schema.hasSystemCategory ? ", system_category" : ""}
       FROM open_finance_transactions
       WHERE owner_id = ? AND dedupe_key = ?`,
    )
    .bind(transaction.ownerId, transaction.dedupeKey)
    .first<Pick<OpenFinanceTransactionRow, "id" | "system_category">>();

  const systemCategory = schema.hasSystemCategory
    ? normalizeSystemCategoryForTransaction(
    {
      description: transaction.description,
      merchant_name: transaction.merchantName,
      original_category: transaction.originalCategory,
      transaction_kind: transaction.transactionKind,
    },
    rules,
      )
    : null;

  if (existing) {
    if (schema.hasSystemCategory && !existing.system_category?.trim() && systemCategory) {
      if (schema.hasOpenFinanceConnectionId) {
        await db
          .prepare(
            `UPDATE open_finance_transactions
             SET system_category = ?, connection_id = COALESCE(connection_id, ?), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(systemCategory, connectionId, existing.id)
          .run();
      } else {
        await db
          .prepare(
            `UPDATE open_finance_transactions
             SET system_category = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(systemCategory, existing.id)
          .run();
      }
      return "updated" as const;
    }

    return "skipped" as const;
  }

  const insertColumns = [
    "owner_id",
    ...(schema.hasOpenFinanceConnectionId ? ["connection_id"] : []),
    "source",
    "source_type",
    "source_account_id",
    "source_bill_id",
    "external_id",
    "dedupe_key",
    "transaction_kind",
    "amount_cents",
    "currency",
    "description",
    "merchant_name",
    "original_category",
    ...(schema.hasSystemCategory ? ["system_category"] : []),
    "user_category",
    "posted_at",
    "raw_json",
  ];
  const values = [
    transaction.ownerId,
    ...(schema.hasOpenFinanceConnectionId ? [connectionId] : []),
    transaction.source,
    transaction.sourceType,
    transaction.sourceAccountId,
    transaction.sourceBillId,
    transaction.externalId,
    transaction.dedupeKey,
    transaction.transactionKind,
    transaction.amountCents,
    transaction.currency,
    transaction.description,
    transaction.merchantName,
    transaction.originalCategory,
    ...(schema.hasSystemCategory ? [systemCategory] : []),
    null,
    transaction.postedAt,
    transaction.rawJson,
  ];

  await db
    .prepare(
      `INSERT INTO open_finance_transactions (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`,
    )
    .bind(...values)
    .run();

  return "inserted" as const;
}

async function fetchNormalizedTransactions(ownerId: number, dateFrom: string, dateTo: string, client: CumbucaMcpClient) {
  const normalized: NormalizedOpenFinanceTransaction[] = [];
  const accounts = await client.callTool<ListAccountsResponse>("list_accounts");

  for (const account of accounts.accounts ?? []) {
    const accountId = typeof account.accountId === "string" ? account.accountId : "";
    if (!accountId) {
      continue;
    }

    const response = await client.callTool<ListTransactionsResponse>("list_account_transactions", {
      account_id: accountId,
      from_date: dateFrom,
      to_date: dateTo,
    });

    for (const transaction of response.transactions ?? []) {
      const item = await normalizeBankTransaction(ownerId, accountId, transaction);
      if (isInsideDateRange(item.postedAt, dateFrom, dateTo)) {
        normalized.push(item);
      }
    }
  }

  const creditCards = await client.callTool<ListCreditCardsResponse>("list_credit_cards");
  for (const card of creditCards.credit_cards ?? []) {
    const cardId = typeof card.creditCardAccountId === "string" ? card.creditCardAccountId : "";
    if (!cardId) {
      continue;
    }

    const bills = await client.callTool<ListBillsResponse>("list_credit_card_bills", {
      credit_card_account_id: cardId,
    });

    for (const bill of bills.bills ?? []) {
      const billId = typeof bill.billId === "string" ? bill.billId : "";
      if (!billId) {
        continue;
      }

      if (!shouldFetchBill(bill.dueDate, dateFrom, dateTo)) {
        continue;
      }

      const response = await client.callTool<ListTransactionsResponse>("list_credit_card_bill_transactions", {
        credit_card_account_id: cardId,
        bill_id: billId,
      });

      for (const transaction of response.transactions ?? []) {
        const item = await normalizeCreditCardTransaction(ownerId, cardId, billId, transaction);
        if (isInsideDateRange(item.postedAt, dateFrom, dateTo)) {
          normalized.push(item);
        }
      }
    }
  }

  return normalized;
}

export interface SyncOptions {
  fullImport?: boolean;
  connectionId?: number;
}

export async function syncOpenFinanceTransactions(env: Env, ownerId: number, options: SyncOptions = {}) {
  const schema = await getDbFeatureFlags(env.DB);
  if (!hasBaseOpenFinanceSchema(schema)) {
    throw new Error("Open Finance ainda nao esta pronto neste ambiente. Aplique as migrations mais recentes e configure a conexao do perfil.");
  }

  if (options.connectionId && !schema.hasOpenFinanceConnections) {
    throw new Error("Aplique a migration de conexoes Open Finance para usar uma conexao especifica do perfil.");
  }

  const requestedConnection = schema.hasOpenFinanceConnections
    ? options.connectionId
      ? await getOpenFinanceConnectionById(env.DB, options.connectionId)
      : await getActiveOpenFinanceConnection(env.DB, ownerId, provider)
    : null;

  if (options.connectionId && !requestedConnection) {
    throw new Error("Conexão Open Finance não encontrada.");
  }

  if (requestedConnection && requestedConnection.profile_id !== ownerId) {
    throw new Error("A conexão Open Finance informada não pertence ao perfil selecionado.");
  }

  if (requestedConnection && requestedConnection.status !== "active") {
    throw new Error("A conexão Open Finance informada não está ativa.");
  }

  const connectionId = requestedConnection?.id ?? null;
  const usingLegacyGlobalConnection = !requestedConnection && hasLegacyGlobalCumbucaCredentials(env);
  if (!requestedConnection && !usingLegacyGlobalConnection) {
    throw new Error("Configure uma conexão Open Finance para este perfil em Ajustes > Open Finance.");
  }

  const state = await ensureSyncState(env.DB, ownerId, connectionId, schema);
  if (isFreshRunningState(state)) {
    throw new Error("Uma atualização já está em andamento. Tente novamente em alguns instantes.");
  }

  const mode = options.fullImport || !state?.last_success_at ? "initial_import" : "incremental_update";
  const dateFrom = mode === "initial_import" ? firstImportDate : subtractDays(state?.last_success_at ?? firstImportDate, 3);
  const dateTo = todaySaoPaulo();
  const startedAt = nowIso();

  await markStateRunning(env.DB, ownerId, startedAt, mode === "initial_import");
  const job = await createJob(env.DB, ownerId, connectionId, dateFrom, dateTo, startedAt, schema);
  const jobId = job?.id ?? null;

  try {
    const credentials = requestedConnection ? await loadDecryptedCumbucaCredentials(env, requestedConnection) : undefined;
    const client = new CumbucaMcpClient(env, credentials);
    const transactions = await fetchNormalizedTransactions(ownerId, dateFrom, dateTo, client);
    const rules = await listActiveCategoryRules(env.DB, ownerId);
    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    for (const transaction of transactions) {
      const result = await upsertTransaction(env.DB, transaction, rules, schema, connectionId);
      if (result === "inserted") {
        inserted += 1;
      } else if (result === "updated") {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    const finishedAt = nowIso();
    await markSuccess(env.DB, ownerId, connectionId, jobId ?? 0, inserted, skipped, updated, finishedAt, schema);

    return {
      success: true,
      mode,
      dateFrom,
      dateTo,
      inserted,
      skipped,
      updated,
      lastSuccessAt: finishedAt,
      connectionId,
      usingLegacyGlobalConnection,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar os dados.";
    await markFailure(env.DB, ownerId, connectionId, jobId, message, nowIso(), schema);
    throw new Error(message, { cause: error });
  }
}
