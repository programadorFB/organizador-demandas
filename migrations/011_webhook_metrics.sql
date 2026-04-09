-- ========================================
-- Migration 011: Tabelas para métricas de webhooks Kommo
-- Processamento completo: unsorted, talk, message
-- ========================================

-- Leads não classificados (vindos do WhatsApp/chat)
CREATE TABLE IF NOT EXISTS kommo_unsorted_leads (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(255),
  kommo_lead_id INTEGER,
  lead_name VARCHAR(255),
  contact_id INTEGER,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  source VARCHAR(100),
  source_name VARCHAR(255),
  category VARCHAR(50),
  pipeline_id INTEGER,
  initial_message TEXT,
  seller_kommo_id INTEGER,
  event_action VARCHAR(20) DEFAULT 'add',
  webhook_event_id INTEGER REFERENCES kommo_webhook_events(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_unsorted_leads_created ON kommo_unsorted_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unsorted_leads_source ON kommo_unsorted_leads(source);
CREATE INDEX IF NOT EXISTS idx_unsorted_leads_seller ON kommo_unsorted_leads(seller_kommo_id);

-- Conversas (talk events)
CREATE TABLE IF NOT EXISTS kommo_conversations (
  id SERIAL PRIMARY KEY,
  talk_id INTEGER NOT NULL,
  chat_id VARCHAR(255),
  lead_id INTEGER,
  contact_id INTEGER,
  origin VARCHAR(100),
  is_read BOOLEAN DEFAULT false,
  is_in_work BOOLEAN DEFAULT false,
  rate INTEGER DEFAULT 0,
  seller_kommo_id INTEGER,
  webhook_event_id INTEGER REFERENCES kommo_webhook_events(id),
  first_seen_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_talk ON kommo_conversations(talk_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON kommo_conversations(seller_kommo_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON kommo_conversations(updated_at DESC);

-- Mensagens individuais
CREATE TABLE IF NOT EXISTS kommo_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(255),
  talk_id INTEGER,
  chat_id VARCHAR(255),
  lead_id INTEGER,
  contact_id INTEGER,
  author_name VARCHAR(255),
  author_type VARCHAR(20),
  text TEXT,
  msg_type VARCHAR(20),
  origin VARCHAR(100),
  seller_kommo_id INTEGER,
  webhook_event_id INTEGER REFERENCES kommo_webhook_events(id),
  message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_talk ON kommo_messages(talk_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON kommo_messages(msg_type);
CREATE INDEX IF NOT EXISTS idx_messages_seller ON kommo_messages(seller_kommo_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON kommo_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON kommo_messages(message_id);

-- Métricas diárias agregadas por vendedora (cache para queries rápidas)
CREATE TABLE IF NOT EXISTS kommo_daily_metrics (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES sellers(id),
  kommo_user_id INTEGER,
  metric_date DATE NOT NULL,
  unsorted_received INTEGER DEFAULT 0,
  messages_incoming INTEGER DEFAULT 0,
  messages_outgoing INTEGER DEFAULT 0,
  conversations_active INTEGER DEFAULT 0,
  conversations_read INTEGER DEFAULT 0,
  conversations_unread INTEGER DEFAULT 0,
  avg_response_time_min DECIMAL(10,2),
  first_response_time_min DECIMAL(10,2),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(kommo_user_id, metric_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_seller ON kommo_daily_metrics(seller_id, metric_date DESC);
