-- CS50 Final Project — migrations/0001_initial_schema.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  amount REAL NOT NULL CHECK (amount >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (profile_id, month, year)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  current_amount REAL NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reserve_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monthly_income_profile_month ON monthly_income(profile_id, year, month);
CREATE INDEX IF NOT EXISTS idx_expenses_profile_date ON expenses(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_profile_category ON expenses(profile_id, category);
CREATE INDEX IF NOT EXISTS idx_goals_profile ON savings_goals(profile_id);
CREATE INDEX IF NOT EXISTS idx_reserve_profile ON reserve_entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_categories_profile ON categories(profile_id);

CREATE TRIGGER IF NOT EXISTS profiles_updated_at
AFTER UPDATE ON profiles
FOR EACH ROW
BEGIN
  UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS monthly_income_updated_at
AFTER UPDATE ON monthly_income
FOR EACH ROW
BEGIN
  UPDATE monthly_income SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS expenses_updated_at
AFTER UPDATE ON expenses
FOR EACH ROW
BEGIN
  UPDATE expenses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS savings_goals_updated_at
AFTER UPDATE ON savings_goals
FOR EACH ROW
BEGIN
  UPDATE savings_goals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reserve_entries_updated_at
AFTER UPDATE ON reserve_entries
FOR EACH ROW
BEGIN
  UPDATE reserve_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
  UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

INSERT INTO profiles (id, name)
VALUES
  (1, 'Principal'),
  (2, 'Compartilhado')
ON CONFLICT(id) DO UPDATE SET name = excluded.name;

INSERT OR IGNORE INTO categories (id, profile_id, name, color)
VALUES
  (1, NULL, 'Food', '#22c55e'),
  (2, NULL, 'Transport', '#06b6d4'),
  (3, NULL, 'Housing', '#8b5cf6'),
  (4, NULL, 'Health', '#ef4444'),
  (5, NULL, 'Entertainment', '#ec4899'),
  (6, NULL, 'Subscriptions', '#f97316'),
  (7, NULL, 'Shopping', '#eab308'),
  (8, NULL, 'Investments', '#10b981'),
  (9, NULL, 'Other', '#94a3b8');
