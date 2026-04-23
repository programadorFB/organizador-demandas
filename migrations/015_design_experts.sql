-- Migration 015: Experts gerenciáveis pelo admin de designers
-- Substitui a lista fixa em src/constants/experts.js por uma tabela persistente.
-- Mantemos expert_name em design_cards como texto livre (histórico preservado mesmo se o expert for desativado).

CREATE TABLE IF NOT EXISTS design_experts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_experts_active ON design_experts(active);

-- Seed com a lista canônica atual
INSERT INTO design_experts (name, sort_order) VALUES
  ('FUZATTO', 1),
  ('DENNY', 2),
  ('SAND', 3),
  ('ISA', 4),
  ('PHANTOM', 5),
  ('ALINE', 6),
  ('JOAO SLOTS', 7),
  ('VANESSA', 8),
  ('WIU', 9),
  ('KAIQUE', 10),
  ('TIPSTER', 11),
  ('CAROL SLOTS', 12),
  ('REMI', 13)
ON CONFLICT (name) DO NOTHING;
