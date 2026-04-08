-- ========================================
-- Migration 010: Seed vendedoras + mapeamento Kommo
-- ========================================

-- Sara (admin de vendas)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Sara', 'sara.fbmarketing@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'sales_admin')
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role;

-- Vendedoras (senha: 123456)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Malu', 'grmalu9@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora'),
  ('Laura', 'laurafbmarketing@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora'),
  ('Gabrielle', 'gabfbmarketing@outlook.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora'),
  ('Paulo', 'paulo.fbmarketing@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora'),
  ('Rita', 'annarifb@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora'),
  ('Joao Pedro', 'jpFBmarketing06@gmail.com', '$2a$10$AgHCWyzfAAROfhm5jCVkOenb3dk7foCTwprH48Td3FKPtM7DTo04.', 'vendedora')
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role;

-- Sellers (vinculados aos users)
INSERT INTO sellers (user_id, shift)
SELECT id, 'completo' FROM users WHERE role = 'vendedora'
ON CONFLICT (user_id) DO NOTHING;

-- Mapeamento Kommo users
INSERT INTO kommo_user_map (kommo_user_id, kommo_user_name, kommo_user_email) VALUES
  (13506431, 'Fuzabalta', 'fuzabalta7d@gmail.com'),
  (13533107, 'Sara', 'sara.fbmarketing@gmail.com'),
  (13533511, 'Malu', 'grmalu9@gmail.com'),
  (14062347, 'Laura', 'laurafbmarketing@gmail.com'),
  (14259087, 'Gabrielle', 'gabfbmarketing@outlook.com'),
  (14260415, 'Paulo', 'paulo.fbmarketing@gmail.com'),
  (14635428, 'Rita', 'annarifb@gmail.com'),
  (14887344, 'Joao Pedro', 'jpFBmarketing06@gmail.com')
ON CONFLICT (kommo_user_id) DO UPDATE SET kommo_user_name=EXCLUDED.kommo_user_name, kommo_user_email=EXCLUDED.kommo_user_email;

-- Vincular Kommo users → sellers (por email)
UPDATE kommo_user_map SET seller_id = s.id
FROM sellers s JOIN users u ON u.id = s.user_id
WHERE u.email = kommo_user_map.kommo_user_email
  AND kommo_user_map.kommo_user_email NOT IN ('fuzabalta7d@gmail.com', 'sara.fbmarketing@gmail.com');
