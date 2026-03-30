import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';

const { Client } = pg;

async function setup() {
  // Conectar ao postgres padrão para criar o banco
  const adminClient = new Client({
    connectionString: process.env.DATABASE_URL.replace(/\/[^/]+$/, '/postgres')
  });

  try {
    await adminClient.connect();
    const dbName = 'organizador_demandas';
    const exists = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (!exists.rows.length) {
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✓ Banco "${dbName}" criado`);
    } else {
      console.log(`✓ Banco "${dbName}" já existe`);
    }
  } finally {
    await adminClient.end();
  }

  // Conectar ao banco do projeto e rodar migrations
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const migration = readFileSync('migrations/001_initial.sql', 'utf-8');
    await client.query(migration);
    console.log('✓ Migrations executadas');

    // Criar admin padrão se não existir
    const adminExists = await client.query(`SELECT id FROM users WHERE email = 'admin@admin.com'`);
    if (!adminExists.rows.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
        ['Administrador', 'admin@admin.com', hash, 'admin']
      );
      console.log('✓ Admin criado: admin@admin.com / admin123');
    } else {
      console.log('✓ Admin já existe');
    }

    console.log('\n🚀 Setup concluído! Rode: npm start');
  } finally {
    await client.end();
  }
}

setup().catch(err => {
  console.error('Erro no setup:', err.message);
  process.exit(1);
});
