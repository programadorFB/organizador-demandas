-- ========================================
-- Migration 009: Tabela de eventos webhook Kommo
-- ========================================

CREATE TABLE IF NOT EXISTS kommo_webhook_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON kommo_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON kommo_webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON kommo_webhook_events(processed);

-- Limpar eventos antigos automaticamente (manter últimos 30 dias)
-- Executar periodicamente: DELETE FROM kommo_webhook_events WHERE created_at < NOW() - interval '30 days';
