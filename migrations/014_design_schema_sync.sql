-- Migration 014: Sincronizar schema local com o que o backend espera
-- - sort_order em design_attachments e design_links (usado em ORDER BY e reorder endpoints)
-- - bg_image e bg_effect em users (usado em /api/design/preferences; accent_color já veio na 013)

ALTER TABLE design_attachments ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE design_links ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS bg_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bg_effect VARCHAR(20) DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20);
