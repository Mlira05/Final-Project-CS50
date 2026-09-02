-- CS50 Final Project demo dataset.
-- AI assistance citation: OpenAI Codex helped prepare this isolated, synthetic dataset;
-- no real financial records or production credentials are included.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO monthly_income (id, profile_id, month, year, amount, notes)
VALUES
  (1001, 1, CAST(strftime('%m', 'now') AS INTEGER), CAST(strftime('%Y', 'now') AS INTEGER), 6800.00, 'Renda mensal demonstrativa'),
  (1002, 2, CAST(strftime('%m', 'now') AS INTEGER), CAST(strftime('%Y', 'now') AS INTEGER), 4200.00, 'Renda mensal demonstrativa');

INSERT OR IGNORE INTO expenses (id, profile_id, name, category, amount, date, payment_method, notes)
VALUES
  (1001, 1, 'Aluguel', 'Moradia', 1850.00, date('now', '-8 days'), 'Transferência', 'Registro fictício para a demonstração'),
  (1002, 1, 'Supermercado', 'Alimentação', 486.40, date('now', '-5 days'), 'Cartão de crédito', 'Registro fictício para a demonstração'),
  (1003, 1, 'Transporte', 'Transporte', 165.90, date('now', '-3 days'), 'Cartão de crédito', 'Registro fictício para a demonstração'),
  (1004, 1, 'Streaming', 'Assinaturas', 55.90, date('now', '-2 days'), 'Cartão de crédito', 'Registro fictício para a demonstração'),
  (1005, 2, 'Curso online', 'Educação', 249.00, date('now', '-6 days'), 'PIX', 'Registro fictício para a demonstração'),
  (1006, 2, 'Farmácia', 'Saúde', 87.35, date('now', '-1 day'), 'Cartão de débito', 'Registro fictício para a demonstração');

INSERT OR IGNORE INTO savings_goals (id, profile_id, name, target_amount, current_amount, deadline, notes, goal_type, priority, status, target_date, owner_mode)
VALUES
  (1001, 1, 'Reserva de emergência', 18000.00, 7200.00, date('now', '+12 months'), 'Meta fictícia para demonstrar cálculo de progresso', 'emergency_fund', 'high', 'active', date('now', '+12 months'), 'individual'),
  (1002, 2, 'Viagem', 8000.00, 2300.00, date('now', '+9 months'), 'Meta fictícia compartilhável', 'travel', 'medium', 'active', date('now', '+9 months'), 'individual');

INSERT OR IGNORE INTO reserve_entries (id, profile_id, name, purpose, amount, notes)
VALUES
  (1001, 1, 'Cofrinho mensal', 'Imprevistos', 950.00, 'Valor fictício para a demonstração'),
  (1002, 2, 'Fundo de estudos', 'Educação', 600.00, 'Valor fictício para a demonstração');
