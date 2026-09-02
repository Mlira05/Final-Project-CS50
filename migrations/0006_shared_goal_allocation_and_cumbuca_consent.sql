-- CS50 Final Project — migrations/0006_shared_goal_allocation_and_cumbuca_consent.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS goal_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant',
  contribution_weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(goal_id, profile_id)
);

INSERT OR IGNORE INTO goal_participants (goal_id, profile_id, role)
SELECT id, profile_id, 'owner'
FROM savings_goals;

INSERT OR IGNORE INTO goal_participants (goal_id, profile_id, role)
SELECT sg.id, p.id, CASE WHEN p.id = sg.profile_id THEN 'owner' ELSE 'participant' END
FROM savings_goals sg
CROSS JOIN profiles p
WHERE sg.owner_mode = 'shared';

ALTER TABLE goal_budget_items ADD COLUMN allocated_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE goal_budget_items ADD COLUMN allocation_order INTEGER NOT NULL DEFAULT 100;
ALTER TABLE goal_budget_items ADD COLUMN allocation_strategy TEXT NOT NULL DEFAULT 'priority_order';

CREATE TABLE IF NOT EXISTS goal_budget_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  budget_item_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  amount REAL NOT NULL,
  allocated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES savings_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (budget_item_id) REFERENCES goal_budget_items(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goal_participants_profile
  ON goal_participants(profile_id, goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_budget_allocations_goal
  ON goal_budget_allocations(goal_id, allocated_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_budget_allocations_item
  ON goal_budget_allocations(budget_item_id, source_type);

CREATE TABLE IF NOT EXISTS cumbuca_consent_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state TEXT NOT NULL UNIQUE,
  profile_id INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cumbuca_consent_states_profile
  ON cumbuca_consent_states(profile_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS goal_participants_updated_at
AFTER UPDATE ON goal_participants
FOR EACH ROW
BEGIN
  UPDATE goal_participants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
