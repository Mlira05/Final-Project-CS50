-- CS50 Final Project — migrations/0008_current_month_demo_expenses.sql: keeps the dashboard populated in any calendar month.
-- AI assistance citation: OpenAI Codex helped prepare this synthetic, date-relative demo data; no real financial records are included.

INSERT OR IGNORE INTO expenses (id, profile_id, name, category, amount, date, payment_method, notes)
VALUES
  (1011, 1, 'Moradia demonstrativa', 'Moradia', 1850.00, date('now', 'start of month'), 'Transferência', 'Registro fictício do CS50'),
  (1012, 1, 'Supermercado demonstrativo', 'Alimentação', 486.40, date('now', 'start of month', '+1 day'), 'Cartão de crédito', 'Registro fictício do CS50'),
  (1013, 1, 'Transporte demonstrativo', 'Transporte', 165.90, date('now', 'start of month', '+1 day'), 'Cartão de crédito', 'Registro fictício do CS50'),
  (1014, 1, 'Streaming demonstrativo', 'Assinaturas', 55.90, date('now', 'start of month', '+1 day'), 'Cartão de crédito', 'Registro fictício do CS50'),
  (1015, 2, 'Curso demonstrativo', 'Educação', 249.00, date('now', 'start of month'), 'PIX', 'Registro fictício do CS50'),
  (1016, 2, 'Saúde demonstrativa', 'Saúde', 87.35, date('now', 'start of month', '+1 day'), 'Cartão de débito', 'Registro fictício do CS50');
