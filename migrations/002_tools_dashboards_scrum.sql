-- Ferramentas / Assinaturas
CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500),
  cost DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  billing_cycle VARCHAR(20) DEFAULT 'mensal' CHECK (billing_cycle IN ('mensal', 'trimestral', 'semestral', 'anual', 'unico', 'gratuito')),
  next_payment_date DATE,
  category VARCHAR(50) DEFAULT 'geral',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dashboards e Links
CREATE TABLE IF NOT EXISTS dashboards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  type VARCHAR(30) DEFAULT 'app' CHECK (type IN ('grafana', 'prometheus', 'app', 'api', 'tunnel', 'database', 'custom')),
  description TEXT,
  port INTEGER,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sprint enhancements
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'review', 'completed'));
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS velocity INTEGER DEFAULT 0;

-- Sprint notes (standups, retros, reviews)
CREATE TABLE IF NOT EXISTS sprint_notes (
  id SERIAL PRIMARY KEY,
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('standup', 'retrospective', 'review', 'planning', 'impediment')),
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sprint_notes_sprint ON sprint_notes(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tools_next_payment ON tools(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_dashboards_active ON dashboards(active);

-- Seed dashboards com serviços da VPS
INSERT INTO dashboards (name, url, type, description, port, sort_order) VALUES
  ('Grafana', 'http://76.13.174.229:3000', 'grafana', 'Monitoramento principal — métricas de todos os serviços', 3000, 1),
  ('Prometheus', 'http://76.13.174.229:9090', 'prometheus', 'Coleta de métricas e alertas', 9090, 2),
  ('Alertmanager', 'http://76.13.174.229:9093', 'prometheus', 'Gerenciamento de alertas e notificações', 9093, 3),
  ('Roleta3 — Frontend', 'http://76.13.174.229:82', 'app', 'Roleta3 principal — análise em tempo real', 82, 10),
  ('Roleta3 — Backend', 'http://76.13.174.229:3002', 'api', 'API Roleta3 principal', 3002, 11),
  ('Roleta3 Sortenabet — Frontend', 'http://76.13.174.229:88', 'app', 'Roleta3 versão Sortenabet', 88, 12),
  ('Roleta3 Sortenabet — Backend', 'http://76.13.174.229:3003', 'api', 'API Roleta3 Sortenabet', 3003, 13),
  ('Roleta3 Free — Frontend', 'http://76.13.174.229:89', 'app', 'Roleta3 versão gratuita', 89, 14),
  ('Roleta3 Free — Backend', 'http://76.13.174.229:3004', 'api', 'API Roleta3 Free', 3004, 15),
  ('Roleta3 Gratis — Frontend', 'http://76.13.174.229:90', 'app', 'Roleta3 versão gratis', 90, 16),
  ('Roleta3 Gratis — Backend', 'http://76.13.174.229:3005', 'api', 'API Roleta3 Gratis', 3005, 17),
  ('Roleta2 — Frontend', 'http://76.13.174.229:81', 'app', 'Roleta2 plataforma de análise', 81, 20),
  ('Roleta2 — Backend', 'http://76.13.174.229:3001', 'api', 'API Roleta2', 3001, 21),
  ('Cronos — Frontend', 'http://76.13.174.229:87', 'app', 'Cronos plataforma', 87, 30),
  ('Cronos — Backend', 'http://76.13.174.229:3007', 'api', 'API Cronos', 3007, 31),
  ('Cronos — WebSocket', 'http://76.13.174.229:8765', 'api', 'Proxy WebSocket Cronos', 8765, 32),
  ('Área de Membros — Frontend', 'http://76.13.174.229:86', 'app', 'Área de membros', 86, 40),
  ('Área de Membros — Backend', 'http://76.13.174.229:8006', 'api', 'API Área de Membros', 8006, 41),
  ('Catalogador — Frontend', 'http://76.13.174.229:83', 'app', 'Catalogador de jogos', 83, 50),
  ('Catalogador — Backend', 'http://76.13.174.229:3083', 'api', 'API Catalogador', 3083, 51),
  ('Gerenciamento Banca — Frontend', 'http://76.13.174.229:84', 'app', 'Gerenciamento de banca', 84, 60),
  ('Gerenciamento Banca — Backend', 'http://76.13.174.229:5004', 'api', 'API Gerenciamento Banca', 5004, 61),
  ('Slots', 'http://76.13.174.229:3009', 'app', 'Dashboard de análise de slots', 3009, 70),
  ('Slots API', 'http://76.13.174.229:5006', 'api', 'API Slots scraper', 5006, 71),
  ('Quebra Algoritmo', 'http://76.13.174.229:3006', 'app', 'Quebra algoritmo plataforma', 3006, 80),
  ('Backend Principal', 'http://76.13.174.229:5005', 'api', 'Backend compartilhado', 5005, 90),
  ('Demandas', 'http://76.13.174.229:3010', 'app', 'Organizador de Demandas (este app)', 3010, 100),
  ('PostgreSQL Principal', '', 'database', 'Banco de dados principal — porta 5432', 5432, 110),
  ('Redis', '', 'database', 'Cache Redis compartilhado', 6379, 111)
ON CONFLICT DO NOTHING;
