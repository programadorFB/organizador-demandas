-- ========================================
-- Migration 007: Integração Kommo CRM
-- ========================================

-- Configuração da conta Kommo (OAuth2 tokens + config)
CREATE TABLE IF NOT EXISTS kommo_config (
  id SERIAL PRIMARY KEY,
  subdomain VARCHAR(100) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret VARCHAR(255) NOT NULL,
  redirect_uri VARCHAR(500) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  pipeline_id INTEGER,
  pipeline_name VARCHAR(255),
  -- IDs dos stages mapeados
  stage_new_lead INTEGER,
  stage_responded INTEGER,
  stage_interested INTEGER,
  stage_won INTEGER,
  stage_lost INTEGER,
  -- Campo customizado para valor da venda
  revenue_field_id INTEGER,
  -- Status
  connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMP,
  sync_interval_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mapeamento de users Kommo → vendedoras do sistema
CREATE TABLE IF NOT EXISTS kommo_user_map (
  id SERIAL PRIMARY KEY,
  kommo_user_id INTEGER NOT NULL,
  kommo_user_name VARCHAR(255),
  kommo_user_email VARCHAR(255),
  seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
  auto_mapped BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(kommo_user_id)
);

-- Log de sincronizações
CREATE TABLE IF NOT EXISTS kommo_sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  leads_processed INTEGER DEFAULT 0,
  reports_created INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP
);

-- Cache de leads processados (evitar duplicatas)
CREATE TABLE IF NOT EXISTS kommo_leads_cache (
  id SERIAL PRIMARY KEY,
  kommo_lead_id INTEGER NOT NULL,
  kommo_user_id INTEGER,
  pipeline_id INTEGER,
  status_id INTEGER,
  revenue DECIMAL(12,2) DEFAULT 0,
  lead_created_at TIMESTAMP,
  lead_updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(kommo_lead_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_kommo_user_map_kommo ON kommo_user_map(kommo_user_id);
CREATE INDEX IF NOT EXISTS idx_kommo_user_map_seller ON kommo_user_map(seller_id);
CREATE INDEX IF NOT EXISTS idx_kommo_leads_cache_user ON kommo_leads_cache(kommo_user_id);
CREATE INDEX IF NOT EXISTS idx_kommo_leads_cache_status ON kommo_leads_cache(status_id);
CREATE INDEX IF NOT EXISTS idx_kommo_leads_cache_date ON kommo_leads_cache(lead_created_at);
