-- Cor de destaque (accent) por usuário do Design Board
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20);
