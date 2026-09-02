-- CS50 Final Project — migrations/0004_category_preprocessing_goals_objectives.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

ALTER TABLE open_finance_transactions ADD COLUMN system_category TEXT;

ALTER TABLE savings_goals ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE savings_goals ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE savings_goals ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE savings_goals ADD COLUMN target_date TEXT;
ALTER TABLE savings_goals ADD COLUMN owner_mode TEXT NOT NULL DEFAULT 'individual';

UPDATE savings_goals
SET target_date = deadline
WHERE target_date IS NULL;

CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('merchant', 'description', 'original_category', 'contains')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  contribution_date TEXT NOT NULL,
  source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_budget_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  planned_amount REAL NOT NULL CHECK (planned_amount >= 0),
  actual_amount REAL NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_transaction_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  budget_item_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES open_finance_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (budget_item_id) REFERENCES goal_budget_items(id) ON DELETE SET NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(goal_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_open_finance_transactions_owner_system_category
  ON open_finance_transactions(owner_id, user_category, system_category, original_category);

CREATE INDEX IF NOT EXISTS idx_category_rules_profile_priority
  ON category_rules(profile_id, is_active, priority, id);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_date
  ON goal_contributions(goal_id, contribution_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_budget_items_goal
  ON goal_budget_items(goal_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_goal_transaction_links_goal
  ON goal_transaction_links(goal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_transaction_links_budget_item
  ON goal_transaction_links(budget_item_id);

CREATE TRIGGER IF NOT EXISTS category_rules_updated_at
AFTER UPDATE ON category_rules
FOR EACH ROW
BEGIN
  UPDATE category_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS goal_contributions_updated_at
AFTER UPDATE ON goal_contributions
FOR EACH ROW
BEGIN
  UPDATE goal_contributions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS goal_budget_items_updated_at
AFTER UPDATE ON goal_budget_items
FOR EACH ROW
BEGIN
  UPDATE goal_budget_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Alimentação', '#22c55e'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Alimentação')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Mercado', '#16a34a'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Mercado')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Delivery', '#f97316'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Delivery')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Restaurantes', '#f59e0b'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Restaurantes')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Transporte', '#0ea5e9'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Transporte')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Uber/99/Táxi', '#06b6d4'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Uber/99/Táxi')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Combustível', '#f97316'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Combustível')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Moradia', '#8b5cf6'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Moradia')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Contas', '#3b82f6'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Contas')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Saúde', '#ef4444'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Saúde')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Farmácia', '#fb7185'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Farmácia')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Educação', '#a855f7'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Educação')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Lazer', '#ec4899'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Lazer')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Assinaturas', '#f97316'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Assinaturas')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Viagem', '#14b8a6'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Viagem')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Hospedagem', '#10b981'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Hospedagem')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Passagens', '#38bdf8'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Passagens')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Compras', '#eab308'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Compras')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Renda', '#10b981'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Renda')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Transferências', '#64748b'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Transferências')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Investimentos', '#059669'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Investimentos')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Impostos/Taxas', '#78716c'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Impostos/Taxas')
);

INSERT INTO categories (profile_id, name, color)
SELECT NULL, 'Sem categoria', '#94a3b8'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE profile_id IS NULL AND lower(name) = lower('Sem categoria')
);
