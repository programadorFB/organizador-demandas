-- Expandir roles para incluir designers
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'supervisor', 'user', 'designer'));

-- Cards do design board
CREATE TABLE IF NOT EXISTS design_cards (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  expert_name VARCHAR(255) NOT NULL,
  description TEXT,
  delivery_type VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'alta', 'urgente')),
  status VARCHAR(30) NOT NULL DEFAULT 'demanda' CHECK (status IN ('links', 'demanda', 'em_andamento', 'analise', 'alteracoes', 'concluidas', 'pos_gestores', 'reunioes')),
  designer_id INTEGER REFERENCES users(id),
  start_date TIMESTAMP,
  deadline TIMESTAMP,
  estimated_hours DECIMAL(5,1),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Checklist dos cards
CREATE TABLE IF NOT EXISTS design_checklist (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  text VARCHAR(255) NOT NULL,
  checked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comentários dos cards
CREATE TABLE IF NOT EXISTS design_comments (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Histórico de movimentações
CREATE TABLE IF NOT EXISTS design_history (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_design_cards_status ON design_cards(status);
CREATE INDEX IF NOT EXISTS idx_design_cards_designer ON design_cards(designer_id);
CREATE INDEX IF NOT EXISTS idx_design_checklist_card ON design_checklist(card_id);
CREATE INDEX IF NOT EXISTS idx_design_comments_card ON design_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_design_history_card ON design_history(card_id);
