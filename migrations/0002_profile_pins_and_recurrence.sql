-- CS50 Final Project — migrations/0002_profile_pins_and_recurrence.sql: Versioned Cloudflare D1 schema or demo-data migration.
-- AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
PRAGMA foreign_keys = ON;

ALTER TABLE profiles ADD COLUMN pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN pin_salt TEXT;

ALTER TABLE monthly_income ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monthly_income ADD COLUMN recurrence_group_id TEXT;
ALTER TABLE monthly_income ADD COLUMN recurrence_start_month INTEGER;
ALTER TABLE monthly_income ADD COLUMN recurrence_start_year INTEGER;
ALTER TABLE monthly_income ADD COLUMN recurrence_end_month INTEGER;
ALTER TABLE monthly_income ADD COLUMN recurrence_end_year INTEGER;

ALTER TABLE expenses ADD COLUMN recurrence_group_id TEXT;
ALTER TABLE expenses ADD COLUMN recurrence_start_date TEXT;
ALTER TABLE expenses ADD COLUMN recurrence_end_date TEXT;

CREATE INDEX IF NOT EXISTS idx_income_recurrence_group ON monthly_income(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recurrence_group ON expenses(recurrence_group_id);

UPDATE profiles
SET
  pin_salt = 'principal-pin-v1',
  pin_hash = '6839dcf099475d9f6247995deabe15eeaf3632c63966292d566c0a5fe79860ce'
WHERE id = 1 AND (pin_hash IS NULL OR pin_hash = '');

UPDATE profiles
SET
  pin_salt = 'shared-pin-v1',
  pin_hash = 'adea444f6fa967a56b202d6cafb284c014e566877166ec89879381a256b01628'
WHERE id = 2 AND (pin_hash IS NULL OR pin_hash = '');

UPDATE categories SET name = 'Alimentação' WHERE name = 'Food';
UPDATE categories SET name = 'Transporte' WHERE name = 'Transport';
UPDATE categories SET name = 'Moradia' WHERE name = 'Housing';
UPDATE categories SET name = 'Saúde' WHERE name = 'Health';
UPDATE categories SET name = 'Lazer' WHERE name = 'Entertainment';
UPDATE categories SET name = 'Assinaturas' WHERE name = 'Subscriptions';
UPDATE categories SET name = 'Compras' WHERE name = 'Shopping';
UPDATE categories SET name = 'Investimentos' WHERE name = 'Investments';
UPDATE categories SET name = 'Outros' WHERE name = 'Other';

