const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const adminId = 1;
  const hash = await bcrypt.hash('123456', 10);

  // Criar designers
  let d1 = (await pool.query("SELECT id FROM users WHERE email='designer@teste.com'")).rows[0];
  if (!d1) {
    d1 = (await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id",
      ['Lucas Editor', 'designer@teste.com', hash, 'designer']
    )).rows[0];
    console.log('Lucas criado, id:', d1.id);
  } else { console.log('Lucas ja existe, id:', d1.id); }

  let d2 = (await pool.query("SELECT id FROM users WHERE email='designer2@teste.com'")).rows[0];
  if (!d2) {
    d2 = (await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id",
      ['Maria Designer', 'designer2@teste.com', hash, 'designer']
    )).rows[0];
    console.log('Maria criada, id:', d2.id);
  } else { console.log('Maria ja existe, id:', d2.id); }

  const cards = [
    { title: 'Criativo Campanha Verao', expert: 'Joao Expert', type: 'Criativo', pri: 'alta', status: 'concluidas', did: d1.id,
      videos: ['Video 1 - Abertura', 'Video 2 - Depoimento cliente', 'Video 3 - CTA final', 'Video 4 - Versao stories'], done: true },
    { title: 'Live Lancamento Produto X', expert: 'Ana Expert', type: 'Live', pri: 'urgente', status: 'em_andamento', did: d1.id,
      videos: ['Video 1 - Intro animada', 'Video 2 - Demo produto', 'Video 3 - Encerramento'], done: false },
    { title: 'Videos Redes Sociais Marco', expert: 'Carlos Expert', type: 'Criativo', pri: 'normal', status: 'concluidas', did: d1.id,
      videos: ['Reels 1 - Dica rapida', 'Reels 2 - Antes e depois', 'Reels 3 - Tutorial', 'Reels 4 - Bastidores', 'Reels 5 - Resultado'], done: true },
    { title: 'Reels Instagram Fitness', expert: 'Pedro Expert', type: 'Criativo', pri: 'normal', status: 'demanda', did: d1.id,
      videos: ['Treino HIIT 30s', 'Receita fit', 'Transformacao'], done: false },
    { title: 'Stories Promo Black Friday', expert: 'Fernanda Expert', type: 'Criativo', pri: 'alta', status: 'concluidas', did: d2.id,
      videos: ['Story 1 - Countdown', 'Story 2 - Oferta principal', 'Story 3 - Depoimento'], done: true },
    { title: 'Video Institucional Empresa Y', expert: 'Roberto Expert', type: 'Live', pri: 'normal', status: 'analise', did: d2.id,
      videos: ['Video 1 - Historia da empresa', 'Video 2 - Equipe', 'Video 3 - Produtos', 'Video 4 - Call to action'], done: false },
    { title: 'Teasers Evento Abril', expert: 'Juliana Expert', type: 'Criativo', pri: 'normal', status: 'em_andamento', did: d2.id,
      videos: ['Teaser 1 - Save the date', 'Teaser 2 - Palestrantes'], done: false },
  ];

  for (const c of cards) {
    const r = await pool.query(
      'INSERT INTO design_cards (title, expert_name, delivery_type, priority, status, designer_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [c.title, c.expert, c.type, c.pri, c.status, c.did, adminId]
    );
    const cardId = r.rows[0].id;

    await pool.query(
      'INSERT INTO design_history (card_id, user_id, action, to_status) VALUES ($1,$2,$3,$4)',
      [cardId, adminId, 'Card criado', c.status]
    );

    for (let i = 0; i < c.videos.length; i++) {
      await pool.query(
        'INSERT INTO design_checklist (card_id, text, checked, sort_order) VALUES ($1,$2,$3,$4)',
        [cardId, c.videos[i], c.done, i]
      );
    }
    console.log(c.status.padEnd(14), '|', c.title, '|', c.videos.length, 'videos', c.done ? '(concluidos)' : '');
  }

  const total = await pool.query('SELECT COUNT(*)::int as c FROM design_checklist');
  console.log('\nTotal checklist items (videos):', total.rows[0].c);
  console.log('\n--- Logins ---');
  console.log('Admin:  admin@admin.com / admin123');
  console.log('Lucas:  designer@teste.com / 123456');
  console.log('Maria:  designer2@teste.com / 123456');

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
