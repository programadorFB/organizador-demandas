-- ========================================
-- Migration 008: Chat Interno + Banco de Conhecimento
-- ========================================

-- Chat interno da equipe de vendas
CREATE TABLE IF NOT EXISTS sales_chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to INTEGER REFERENCES sales_chat_messages(id) ON DELETE SET NULL,
  pinned BOOLEAN DEFAULT false,
  edited BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leitura de mensagens (para marcar "lidas")
CREATE TABLE IF NOT EXISTS sales_chat_reads (
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- Categorias do banco de conhecimento
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '',
  color VARCHAR(20) DEFAULT '#6c5ce7',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Artigos do banco de conhecimento
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  pinned BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON sales_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON sales_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_cat ON knowledge_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_pinned ON knowledge_articles(pinned);

-- Categorias padrão
INSERT INTO knowledge_categories (name, icon, color, sort_order) VALUES
  ('Scripts de Vendas', '', '#6c5ce7', 1),
  ('Objecoes e Respostas', '', '#e17055', 2),
  ('Produtos e Ofertas', '', '#00b894', 3),
  ('Processos e Regras', '', '#fdcb6e', 4),
  ('Dicas e Tecnicas', '', '#00cec9', 5)
ON CONFLICT DO NOTHING;
