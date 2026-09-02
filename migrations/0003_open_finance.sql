-- CS50 Final Project — migrations/0003_open_finance.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS open_finance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_account_id TEXT NOT NULL,
  source_bill_id TEXT,
  external_id TEXT,
  dedupe_key TEXT NOT NULL,
  transaction_kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  description TEXT NOT NULL,
  merchant_name TEXT,
  original_category TEXT,
  user_category TEXT,
  posted_at TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS open_finance_sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  first_import_started_at TEXT,
  last_sync_started_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (owner_id, provider)
);

CREATE TABLE IF NOT EXISTS open_finance_sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_open_finance_transactions_dedupe
  ON open_finance_transactions(owner_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_owner_posted
  ON open_finance_transactions(owner_id, posted_at);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_owner_category
  ON open_finance_transactions(owner_id, user_category, original_category);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_owner_kind
  ON open_finance_transactions(owner_id, transaction_kind);

CREATE INDEX IF NOT EXISTS idx_open_finance_sync_jobs_owner_started
  ON open_finance_sync_jobs(owner_id, started_at);

CREATE TRIGGER IF NOT EXISTS open_finance_transactions_updated_at
AFTER UPDATE ON open_finance_transactions
FOR EACH ROW
BEGIN
  UPDATE open_finance_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS open_finance_sync_state_updated_at
AFTER UPDATE ON open_finance_sync_state
FOR EACH ROW
BEGIN
  UPDATE open_finance_sync_state SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS open_finance_sync_jobs_updated_at
AFTER UPDATE ON open_finance_sync_jobs
FOR EACH ROW
BEGIN
  UPDATE open_finance_sync_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
