-- ========================================
-- Migration 006: Painel de Vendas (Sara)
-- ========================================

-- Atualizar CHECK de roles para incluir sales_admin e vendedora
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'user', 'designer', 'design_admin', 'sales_admin', 'vendedora'));

-- Tabela de vendedoras (perfil estendido)
CREATE TABLE IF NOT EXISTS sellers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift VARCHAR(20) NOT NULL DEFAULT 'completo' CHECK (shift IN ('manha', 'completo')),
  monthly_goal_leads INTEGER DEFAULT 0,
  monthly_goal_sales INTEGER DEFAULT 0,
  monthly_goal_revenue DECIMAL(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de relatórios de vendas
CREATE TABLE IF NOT EXISTS sales_reports (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('manha', 'completo')),
  leads_received INTEGER NOT NULL DEFAULT 0,
  leads_responded INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  sales_closed INTEGER NOT NULL DEFAULT 0,
  revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(seller_id, report_date, report_type)
);

-- Tabela de metas mensais
CREATE TABLE IF NOT EXISTS sales_goals (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  goal_leads INTEGER DEFAULT 0,
  goal_sales INTEGER DEFAULT 0,
  goal_revenue DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(seller_id, month, year)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_sales_reports_seller ON sales_reports(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_reports_date ON sales_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_sales_reports_type ON sales_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_sales_goals_seller ON sales_goals(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_period ON sales_goals(month, year);
CREATE INDEX IF NOT EXISTS idx_sellers_user ON sellers(user_id);
