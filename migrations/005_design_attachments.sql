CREATE TABLE IF NOT EXISTS design_attachments (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_attachments_card ON design_attachments(card_id);
