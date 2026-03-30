-- Tabela de usuários com roles
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'supervisor', 'user')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de sprints
CREATE TABLE IF NOT EXISTS sprints (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de demandas
CREATE TABLE IF NOT EXISTS demands (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('feature', 'bug', 'melhoria', 'tarefa_tecnica', 'documentacao')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status VARCHAR(30) NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'sprint_backlog', 'em_progresso', 'em_revisao', 'concluido', 'cancelado')),
  story_points INTEGER CHECK (story_points IN (1, 2, 3, 5, 8, 13, 21)),
  acceptance_criteria TEXT,
  due_date DATE,
  queue_position SERIAL,
  urgent_approved BOOLEAN DEFAULT NULL,
  urgent_decision_note TEXT,
  sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  assigned_to INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de comentários nas demandas
CREATE TABLE IF NOT EXISTS demand_comments (
  id SERIAL PRIMARY KEY,
  demand_id INTEGER NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_demands_priority ON demands(priority);
CREATE INDEX IF NOT EXISTS idx_demands_requester ON demands(requester_id);
CREATE INDEX IF NOT EXISTS idx_demands_sprint ON demands(sprint_id);
CREATE INDEX IF NOT EXISTS idx_demands_queue ON demands(queue_position);
CREATE INDEX IF NOT EXISTS idx_demand_comments_demand ON demand_comments(demand_id);
