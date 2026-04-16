-- Migration 012: Mapeamento flexível de etapas do pipeline Kommo
CREATE TABLE IF NOT EXISTS kommo_pipeline_stages (
  id SERIAL PRIMARY KEY,
  pipeline_id INTEGER NOT NULL,
  status_id INTEGER NOT NULL UNIQUE,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER DEFAULT 0,
  stage_color VARCHAR(20) DEFAULT '#6c5ce7',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON kommo_pipeline_stages(pipeline_id);
