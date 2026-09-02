-- CS50 Final Project — migrations/0005_open_finance_connections_per_profile.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS open_finance_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'cumbuca',
  holder_name TEXT,
  document_last4 TEXT,
  document_hash TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  client_id_encrypted TEXT,
  token_url TEXT,
  mcp_url TEXT,
  token_expires_at TEXT,
  consent_status TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'active',
  last_success_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_open_finance_connections_profile_provider
  ON open_finance_connections(profile_id, provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_open_finance_connections_one_active_per_profile_provider
  ON open_finance_connections(profile_id, provider)
  WHERE status = 'active';

ALTER TABLE open_finance_transactions ADD COLUMN connection_id INTEGER;
ALTER TABLE open_finance_sync_state ADD COLUMN connection_id INTEGER;
ALTER TABLE open_finance_sync_jobs ADD COLUMN connection_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_connection
  ON open_finance_transactions(connection_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_finance_sync_state_connection
  ON open_finance_sync_state(connection_id, provider);

CREATE INDEX IF NOT EXISTS idx_open_finance_sync_jobs_connection
  ON open_finance_sync_jobs(connection_id, started_at DESC);

CREATE TRIGGER IF NOT EXISTS open_finance_connections_updated_at
AFTER UPDATE ON open_finance_connections
FOR EACH ROW
BEGIN
  UPDATE open_finance_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
