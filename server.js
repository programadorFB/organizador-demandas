import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { readFileSync, unlinkSync } from 'fs';
import { exec } from 'child_process';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const app = express();
const { Pool } = pg;
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

// Upload config
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
app.use('/uploads', express.static('uploads'));

// ─── Auth Middleware ───
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    next();
  };
}

// ─── Auth Routes ───
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hash, 'user']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: payload, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── Demands Routes ───

// Criar demanda (qualquer usuário logado)
app.post('/api/demands', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, priority, story_points, acceptance_criteria, due_date } = req.body;
    if (!title || !description || !category || !priority) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    const result = await pool.query(
      `INSERT INTO demands (title, description, category, priority, story_points, acceptance_criteria, due_date, requester_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, category, priority, story_points || null, acceptance_criteria || null, due_date || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create demand error:', err);
    res.status(500).json({ error: 'Erro ao criar demanda' });
  }
});

// Fila de demandas (visível para qualquer usuário logado — mostra posição sem detalhes sensíveis)
app.get('/api/demands/queue', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.title, d.category, d.priority, d.status, d.story_points, d.created_at,
        d.queue_position, d.urgent_approved, d.requester_id
      FROM demands d
      WHERE d.status NOT IN ('concluido', 'cancelado')
      ORDER BY
        CASE WHEN d.priority = 'urgente' AND d.urgent_approved = true THEN 0 ELSE 1 END,
        d.queue_position ASC
    `);
    const queue = result.rows.map((d, index) => ({
      position: index + 1,
      id: d.id,
      title: d.title,
      category: d.category,
      priority: d.priority,
      status: d.status,
      story_points: d.story_points,
      created_at: d.created_at,
      is_mine: d.requester_id === req.user.id,
      is_urgent_approved: d.priority === 'urgente' && d.urgent_approved === true,
    }));
    res.json(queue);
  } catch (err) {
    console.error('Queue error:', err);
    res.status(500).json({ error: 'Erro ao listar fila' });
  }
});

// Listar demandas (admin/supervisor vê todas, user vê só as suas)
app.get('/api/demands', authMiddleware, async (req, res) => {
  try {
    const { status, priority, category, sprint_id } = req.query;
    let query = `
      SELECT d.*, u.name as requester_name, a.name as assigned_name, sp.name as sprint_name
      FROM demands d
      JOIN users u ON d.requester_id = u.id
      LEFT JOIN users a ON d.assigned_to = a.id
      LEFT JOIN sprints sp ON d.sprint_id = sp.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role === 'user') {
      query += ` AND d.requester_id = $${idx++}`;
      params.push(req.user.id);
    }
    if (status) { query += ` AND d.status = $${idx++}`; params.push(status); }
    if (priority) { query += ` AND d.priority = $${idx++}`; params.push(priority); }
    if (category) { query += ` AND d.category = $${idx++}`; params.push(category); }
    if (sprint_id) { query += ` AND d.sprint_id = $${idx++}`; params.push(sprint_id); }

    query += ` ORDER BY
      CASE WHEN d.priority = 'urgente' AND d.urgent_approved = true THEN 0 ELSE 1 END,
      d.queue_position ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List demands error:', err);
    res.status(500).json({ error: 'Erro ao listar demandas' });
  }
});

// Atualizar status de demanda (admin/supervisor)
app.patch('/api/demands/:id/status', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { status } = req.body;
    const completedAt = status === 'concluido' ? 'NOW()' : 'NULL';
    const result = await pool.query(
      `UPDATE demands SET status = $1, completed_at = ${completedAt}, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Atualizar demanda (admin/supervisor)
app.put('/api/demands/:id', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { title, description, category, priority, story_points, acceptance_criteria, due_date, assigned_to, sprint_id } = req.body;
    const result = await pool.query(
      `UPDATE demands SET title=$1, description=$2, category=$3, priority=$4, story_points=$5,
       acceptance_criteria=$6, due_date=$7, assigned_to=$8, sprint_id=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, description, category, priority, story_points, acceptance_criteria, due_date, assigned_to, sprint_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update demand error:', err);
    res.status(500).json({ error: 'Erro ao atualizar demanda' });
  }
});

// Aprovar/rejeitar urgente (apenas admin)
app.patch('/api/demands/:id/urgent-decision', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { approved, note } = req.body;
    const result = await pool.query(
      `UPDATE demands SET urgent_approved = $1, urgent_decision_note = $2, updated_at = NOW()
       WHERE id = $3 AND priority = 'urgente' RETURNING *`,
      [approved, note || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda urgente não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Urgent decision error:', err);
    res.status(500).json({ error: 'Erro ao decidir urgência' });
  }
});

// Pendentes de aprovação urgente
app.get('/api/demands/urgent/pending', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name as requester_name FROM demands d
       JOIN users u ON d.requester_id = u.id
       WHERE d.priority = 'urgente' AND d.urgent_approved IS NULL
       ORDER BY d.queue_position ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar urgentes' });
  }
});

// Atrelar/desatrelar demanda de sprint (admin/supervisor)
app.patch('/api/demands/:id/sprint', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { sprint_id } = req.body;
    const result = await pool.query(
      'UPDATE demands SET sprint_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [sprint_id || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update sprint error:', err);
    res.status(500).json({ error: 'Erro ao atrelar demanda à sprint' });
  }
});

// Deletar demanda (admin)
app.delete('/api/demands/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM demands WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar' });
  }
});

// ─── Comments ───
app.get('/api/demands/:id/comments', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as user_name FROM demand_comments c
       JOIN users u ON c.user_id = u.id WHERE c.demand_id = $1 ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar comentários' });
  }
});

app.post('/api/demands/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const result = await pool.query(
      `INSERT INTO demand_comments (demand_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.id, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
});

// ─── Attachments ───
app.get('/api/demands/:id/attachments', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name FROM demand_attachments a
       JOIN users u ON a.user_id = u.id WHERE a.demand_id = $1 ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar anexos' });
  }
});

app.post('/api/demands/:id/attachments', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const results = [];
    for (const file of req.files) {
      const r = await pool.query(
        `INSERT INTO demand_attachments (demand_id, user_id, filename, original_name, mime_type, size)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.id, req.user.id, file.filename, file.originalname, file.mimetype, file.size]
      );
      results.push(r.rows[0]);
    }
    res.status(201).json(results);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

app.delete('/api/attachments/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM demand_attachments WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Anexo não encontrado' });
    const attachment = result.rows[0];
    if (attachment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    try { unlinkSync(`uploads/${attachment.filename}`); } catch {}
    await pool.query('DELETE FROM demand_attachments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar anexo' });
  }
});

// ─── Sprints ───
app.get('/api/sprints', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sprints ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar sprints' });
  }
});

app.post('/api/sprints', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { name, goal, start_date, end_date } = req.body;
    const result = await pool.query(
      'INSERT INTO sprints (name, goal, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, goal, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar sprint' });
  }
});

app.patch('/api/sprints/:id/activate', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    await pool.query('UPDATE sprints SET active = false');
    const result = await pool.query('UPDATE sprints SET active = true WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ativar sprint' });
  }
});

// ─── Users (admin) ───
app.get('/api/users', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, active, created_at FROM users ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

app.patch('/api/users/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'supervisor', 'user', 'designer', 'design_admin'].includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar role' });
  }
});

app.patch('/api/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING id, name, email, role, active',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
});

// ─── Stats ───
app.get('/api/stats', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT status, COUNT(*)::int as count FROM demands GROUP BY status
    `);
    const byPriority = await pool.query(`
      SELECT priority, COUNT(*)::int as count FROM demands WHERE status != 'concluido' GROUP BY priority
    `);
    const urgentPending = await pool.query(`
      SELECT COUNT(*)::int as count FROM demands WHERE priority = 'urgente' AND urgent_approved IS NULL
    `);
    const totalPoints = await pool.query(`
      SELECT COALESCE(SUM(story_points), 0)::int as total FROM demands WHERE status = 'concluido'
    `);
    res.json({
      byStatus: counts.rows,
      byPriority: byPriority.rows,
      urgentPending: urgentPending.rows[0].count,
      completedPoints: totalPoints.rows[0].total
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar stats' });
  }
});

// ─── Tools / Ferramentas ───
app.get('/api/tools', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tools ORDER BY next_payment_date ASC NULLS LAST');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar ferramentas' });
  }
});

app.post('/api/tools', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, url, cost, currency, billing_cycle, next_payment_date, category } = req.body;
    const result = await pool.query(
      `INSERT INTO tools (name, description, url, cost, currency, billing_cycle, next_payment_date, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description, url, cost || 0, currency || 'BRL', billing_cycle || 'mensal', next_payment_date, category || 'geral']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar ferramenta' });
  }
});

app.put('/api/tools/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, url, cost, currency, billing_cycle, next_payment_date, category, active } = req.body;
    const result = await pool.query(
      `UPDATE tools SET name=$1, description=$2, url=$3, cost=$4, currency=$5, billing_cycle=$6,
       next_payment_date=$7, category=$8, active=$9, updated_at=NOW() WHERE id=$10 RETURNING *`,
      [name, description, url, cost, currency, billing_cycle, next_payment_date, category, active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Não encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar ferramenta' });
  }
});

app.delete('/api/tools/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM tools WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar ferramenta' });
  }
});

app.get('/api/tools/summary', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const monthly = await pool.query(`
      SELECT COALESCE(SUM(CASE
        WHEN billing_cycle = 'mensal' THEN cost
        WHEN billing_cycle = 'trimestral' THEN cost / 3
        WHEN billing_cycle = 'semestral' THEN cost / 6
        WHEN billing_cycle = 'anual' THEN cost / 12
        ELSE 0 END), 0)::numeric(10,2) as monthly_total
      FROM tools WHERE active = true AND billing_cycle != 'gratuito'
    `);
    const upcoming = await pool.query(`
      SELECT COUNT(*)::int as count FROM tools
      WHERE active = true AND next_payment_date IS NOT NULL
      AND next_payment_date <= CURRENT_DATE + INTERVAL '7 days'
    `);
    const overdue = await pool.query(`
      SELECT COUNT(*)::int as count FROM tools
      WHERE active = true AND next_payment_date IS NOT NULL
      AND next_payment_date < CURRENT_DATE
    `);
    res.json({
      monthlyTotal: parseFloat(monthly.rows[0].monthly_total),
      upcomingPayments: upcoming.rows[0].count,
      overduePayments: overdue.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

// ─── Dashboards / Infraestrutura ───
app.get('/api/dashboards', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dashboards WHERE active = true ORDER BY sort_order ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar dashboards' });
  }
});

app.post('/api/dashboards', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, url, type, description, port, sort_order } = req.body;
    const result = await pool.query(
      'INSERT INTO dashboards (name, url, type, description, port, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, url, type || 'custom', description, port, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar dashboard' });
  }
});

app.put('/api/dashboards/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, url, type, description, port, sort_order, active } = req.body;
    const result = await pool.query(
      `UPDATE dashboards SET name=$1, url=$2, type=$3, description=$4, port=$5, sort_order=$6, active=$7 WHERE id=$8 RETURNING *`,
      [name, url, type, description, port, sort_order, active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar dashboard' });
  }
});

app.delete('/api/dashboards/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM dashboards WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar dashboard' });
  }
});

// Container status — roda docker ps no host
app.get('/api/infrastructure/containers', authMiddleware, roleMiddleware('admin', 'supervisor'), (req, res) => {
  exec('docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}"', (err, stdout) => {
    if (err) return res.json([]);
    const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [name, status, ports, image] = line.split('|');
      return { name, status, ports, image, healthy: status.includes('healthy') || status.includes('Up') };
    });
    res.json(containers);
  });
});

// ─── Scrum Master ───

// Enhanced sprint CRUD
app.get('/api/scrum/sprints', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        COALESCE((SELECT SUM(story_points) FROM demands WHERE sprint_id = s.id AND story_points IS NOT NULL), 0)::int as total_points,
        COALESCE((SELECT SUM(story_points) FROM demands WHERE sprint_id = s.id AND status = 'concluido' AND story_points IS NOT NULL), 0)::int as completed_points,
        (SELECT COUNT(*) FROM demands WHERE sprint_id = s.id)::int as total_demands,
        (SELECT COUNT(*) FROM demands WHERE sprint_id = s.id AND status = 'concluido')::int as completed_demands
      FROM sprints s ORDER BY s.start_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar sprints' });
  }
});

app.post('/api/scrum/sprints', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { name, goal, start_date, end_date } = req.body;
    const result = await pool.query(
      `INSERT INTO sprints (name, goal, start_date, end_date, status) VALUES ($1,$2,$3,$4,'planning') RETURNING *`,
      [name, goal, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar sprint' });
  }
});

app.patch('/api/scrum/sprints/:id/start', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    await pool.query("UPDATE sprints SET status = 'completed' WHERE status = 'active'");
    const result = await pool.query(
      "UPDATE sprints SET status = 'active', active = true WHERE id = $1 RETURNING *", [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao iniciar sprint' });
  }
});

app.patch('/api/scrum/sprints/:id/close', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const vel = await pool.query(
      "SELECT COALESCE(SUM(story_points),0)::int as v FROM demands WHERE sprint_id = $1 AND status = 'concluido'",
      [req.params.id]
    );
    const result = await pool.query(
      "UPDATE sprints SET status = 'completed', active = false, velocity = $1 WHERE id = $2 RETURNING *",
      [vel.rows[0].v, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fechar sprint' });
  }
});

// Burndown data
app.get('/api/scrum/sprints/:id/burndown', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const sprint = await pool.query('SELECT * FROM sprints WHERE id = $1', [req.params.id]);
    if (!sprint.rows.length) return res.status(404).json({ error: 'Sprint não encontrada' });
    const s = sprint.rows[0];

    const totalPts = await pool.query(
      "SELECT COALESCE(SUM(story_points),0)::int as total FROM demands WHERE sprint_id = $1 AND story_points IS NOT NULL",
      [req.params.id]
    );
    const total = totalPts.rows[0].total;

    const completedByDay = await pool.query(
      `SELECT DATE(completed_at) as day, COALESCE(SUM(story_points),0)::int as pts
       FROM demands WHERE sprint_id = $1 AND status = 'concluido' AND completed_at IS NOT NULL AND story_points IS NOT NULL
       GROUP BY DATE(completed_at) ORDER BY day`,
      [req.params.id]
    );

    const start = new Date(s.start_date);
    const end = new Date(s.end_date);
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000*60*60*24)));
    const dailyIdeal = total / totalDays;

    const completedMap = {};
    completedByDay.rows.forEach(r => { completedMap[r.day.toISOString().split('T')[0]] = r.pts; });

    const points = [];
    let cumCompleted = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      cumCompleted += (completedMap[key] || 0);
      const dayIndex = Math.ceil((d - start) / (1000*60*60*24));
      points.push({
        date: key,
        ideal: Math.max(0, Math.round((total - dailyIdeal * dayIndex) * 10) / 10),
        actual: total - cumCompleted
      });
    }
    res.json({ total, points });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar burndown' });
  }
});

// Velocity (últimas sprints)
app.get('/api/scrum/velocity', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, velocity, start_date, end_date FROM sprints
      WHERE status = 'completed' AND velocity IS NOT NULL AND velocity > 0
      ORDER BY end_date DESC LIMIT 10
    `);
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar velocity' });
  }
});

// Sprint notes (standups, retros)
app.get('/api/scrum/sprints/:id/notes', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { type } = req.query;
    let query = `SELECT n.*, u.name as user_name FROM sprint_notes n JOIN users u ON n.user_id = u.id WHERE n.sprint_id = $1`;
    const params = [req.params.id];
    if (type) { query += ' AND n.type = $2'; params.push(type); }
    query += ' ORDER BY n.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar notas' });
  }
});

app.post('/api/scrum/sprints/:id/notes', authMiddleware, roleMiddleware('admin', 'supervisor'), async (req, res) => {
  try {
    const { type, content } = req.body;
    const result = await pool.query(
      'INSERT INTO sprint_notes (sprint_id, type, content, user_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, type, content, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar nota' });
  }
});

app.delete('/api/scrum/notes/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM sprint_notes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar nota' });
  }
});

// ─── Design Board ───
const designAccess = ['admin', 'design_admin', 'designer'];
const designAdmin = ['admin', 'design_admin'];

// Designers list
app.get('/api/design/designers', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role FROM users WHERE role IN ('designer','design_admin') AND active = true ORDER BY name");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro ao listar designers' }); }
});

// Cards list
app.get('/api/design/cards', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { status, designer_id } = req.query;
    let query = `
      SELECT c.*, d.name as designer_name, cb.name as created_by_name,
        (SELECT COUNT(*) FROM design_checklist WHERE card_id = c.id)::int as checklist_total,
        (SELECT COUNT(*) FROM design_checklist WHERE card_id = c.id AND checked = true)::int as checklist_done,
        (SELECT COUNT(*) FROM design_comments WHERE card_id = c.id)::int as comments_count
      FROM design_cards c
      LEFT JOIN users d ON c.designer_id = d.id
      JOIN users cb ON c.created_by = cb.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    // Designers only see their own cards in their visible columns
    if (req.user.role === 'designer') {
      query += ` AND c.designer_id = $${idx++}`; params.push(req.user.id);
      query += ` AND c.status IN ('links', 'demanda', 'em_andamento', 'alteracoes')`;
    }
    if (status) { query += ` AND c.status = $${idx++}`; params.push(status); }
    if (designer_id) { query += ` AND c.designer_id = $${idx++}`; params.push(designer_id); }
    query += ` ORDER BY c.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar cards' }); }
});

// Create card
app.post('/api/design/cards', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const { title, expert_name, description, delivery_type, priority, status, designer_id, start_date, deadline, estimated_hours } = req.body;
    const result = await pool.query(
      `INSERT INTO design_cards (title, expert_name, description, delivery_type, priority, status, designer_id, start_date, deadline, estimated_hours, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, expert_name, description, delivery_type || null, priority || 'normal', status || 'demanda', designer_id || null, start_date || null, deadline || null, estimated_hours || null, req.user.id]
    );
    const card = result.rows[0];
    await pool.query('INSERT INTO design_history (card_id, user_id, action, to_status) VALUES ($1,$2,$3,$4)', [card.id, req.user.id, 'Card criado', card.status]);
    // Notificar designer atribuído
    if (card.designer_id && card.designer_id !== req.user.id) {
      await pool.query('INSERT INTO design_notifications (user_id, card_id, message, type) VALUES ($1,$2,$3,$4)',
        [card.designer_id, card.id, `Nova demanda atribuída: "${card.title}"`, 'nova']);
    }
    res.status(201).json(card);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar card' }); }
});

// Update card
app.put('/api/design/cards/:id', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const { title, expert_name, description, delivery_type, priority, designer_id, start_date, deadline, estimated_hours } = req.body;
    const result = await pool.query(
      `UPDATE design_cards SET title=$1, expert_name=$2, description=$3, delivery_type=$4, priority=$5, designer_id=$6, start_date=$7, deadline=$8, estimated_hours=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, expert_name, description, delivery_type, priority, designer_id, start_date, deadline, estimated_hours, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar card' }); }
});

// Delete card
app.delete('/api/design/cards/:id', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    await pool.query('DELETE FROM design_cards WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao deletar card' }); }
});

// Move card (status change)
app.patch('/api/design/cards/:id/move', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { status, comment } = req.body;
    const card = await pool.query('SELECT * FROM design_cards WHERE id = $1', [req.params.id]);
    if (!card.rows.length) return res.status(404).json({ error: 'Card não encontrado' });
    const c = card.rows[0];
    // Designer: validar transições permitidas
    if (req.user.role === 'designer') {
      if (c.designer_id !== req.user.id) return res.status(403).json({ error: 'Não é seu card' });
      const allowed = { demanda: ['em_andamento'], em_andamento: ['analise'], alteracoes: ['analise'] };
      if (!allowed[c.status]?.includes(status)) {
        return res.status(403).json({ error: 'Movimento não permitido' });
      }
    }
    const result = await pool.query('UPDATE design_cards SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, req.params.id]);
    // Registrar histórico
    const actionLabel = status === 'analise' ? 'Enviado para revisão' : status === 'alteracoes' ? 'Alteração solicitada' : status === 'concluidas' ? 'Aprovado' : `Movido para ${status}`;
    await pool.query('INSERT INTO design_history (card_id, user_id, action, from_status, to_status, details) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.params.id, req.user.id, actionLabel, c.status, status, comment || null]);
    // Se tem comentário (ex: pedir alteração), salvar como comentário
    if (comment) {
      await pool.query('INSERT INTO design_comments (card_id, user_id, content) VALUES ($1,$2,$3)', [req.params.id, req.user.id, comment]);
    }
    // Notificações persistentes
    const statusLabels = { links:'Links', demanda:'Demanda', em_andamento:'Em Andamento', analise:'Análise', alteracoes:'Alterações', concluidas:'Concluídas', pos_gestores:'Pós Gestores', reunioes:'Reuniões' };
    // Notificar designer quando card é movido para ele (alterações, demanda, etc)
    if (c.designer_id && c.designer_id !== req.user.id) {
      const msg = status === 'alteracoes'
        ? `"${c.title}" precisa de alterações${comment ? ': ' + comment : ''}`
        : status === 'demanda'
        ? `Nova demanda atribuída: "${c.title}"`
        : `"${c.title}" foi movido para ${statusLabels[status] || status}`;
      await pool.query('INSERT INTO design_notifications (user_id, card_id, message, type) VALUES ($1,$2,$3,$4)',
        [c.designer_id, c.id, msg, status === 'alteracoes' ? 'alteracoes' : status === 'concluidas' ? 'aprovado' : 'movido']);
    }
    // Notificar admins quando card vai para análise
    if (status === 'analise') {
      const designerName = (await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0]?.name || 'Designer';
      const admins = await pool.query("SELECT id FROM users WHERE role IN ('admin','design_admin') AND id != $1", [req.user.id]);
      for (const adm of admins.rows) {
        await pool.query('INSERT INTO design_notifications (user_id, card_id, message, type) VALUES ($1,$2,$3,$4)',
          [adm.id, c.id, `"${c.title}" enviado para revisão por ${designerName}`, 'analise']);
      }
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao mover card' }); }
});

// Checklist
app.get('/api/design/cards/:id/checklist', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM design_checklist WHERE card_id = $1 ORDER BY section NULLS FIRST, sort_order, id', [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/design/cards/:id/checklist', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { text, section } = req.body;
    const result = await pool.query('INSERT INTO design_checklist (card_id, text, section) VALUES ($1,$2,$3) RETURNING *', [req.params.id, text, section || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.patch('/api/design/checklist/:id/toggle', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query('UPDATE design_checklist SET checked = NOT checked WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/design/checklist/:id', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    await pool.query('DELETE FROM design_checklist WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Comments
app.get('/api/design/cards/:id/comments', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT c.*, u.name as user_name FROM design_comments c JOIN users u ON c.user_id = u.id WHERE c.card_id = $1 ORDER BY c.created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/design/cards/:id/comments', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { content } = req.body;
    const result = await pool.query('INSERT INTO design_comments (card_id, user_id, content) VALUES ($1,$2,$3) RETURNING *', [req.params.id, req.user.id, content]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// History
app.get('/api/design/cards/:id/history', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT h.*, u.name as user_name FROM design_history h JOIN users u ON h.user_id = u.id WHERE h.card_id = $1 ORDER BY h.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Notifications
app.get('/api/design/notifications', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM design_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.patch('/api/design/notifications/read-all', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    await pool.query('UPDATE design_notifications SET read = true WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/design/notifications/unread-count', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int as count FROM design_notifications WHERE user_id = $1 AND read = false', [req.user.id]);
    res.json({ count: result.rows[0].count });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Manage designers (design_admin only)
app.post('/api/design/designers', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha obrigatórios' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha mínima: 6 caracteres' });
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email já cadastrado' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active',
      [name, email, hash, 'designer']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar designer' }); }
});

app.patch('/api/design/designers/:id/toggle-active', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET active = NOT active, updated_at = NOW() WHERE id = $1 AND role = $2 RETURNING id, name, email, role, active',
      [req.params.id, 'designer']
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Designer não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Design Attachments
app.get('/api/design/cards/:id/attachments', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name FROM design_attachments a
       JOIN users u ON a.user_id = u.id WHERE a.card_id = $1 ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro ao listar anexos' }); }
});

app.post('/api/design/cards/:id/attachments', authMiddleware, roleMiddleware(...designAccess), upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const results = [];
    for (const file of req.files) {
      const r = await pool.query(
        `INSERT INTO design_attachments (card_id, user_id, filename, original_name, mime_type, size)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.id, req.user.id, file.filename, file.originalname, file.mimetype, file.size]
      );
      results.push(r.rows[0]);
    }
    res.status(201).json(results);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao fazer upload' }); }
});

app.delete('/api/design/attachments/:id', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM design_attachments WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Anexo não encontrado' });
    const att = result.rows[0];
    if (att.user_id !== req.user.id && !designAdmin.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    try { unlinkSync(`uploads/${att.filename}`); } catch {}
    await pool.query('DELETE FROM design_attachments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao deletar anexo' }); }
});

// Stats
app.get('/api/design/stats', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const total = await pool.query("SELECT COUNT(*)::int as c FROM design_cards WHERE status NOT IN ('concluidas')");
    const done = await pool.query("SELECT COUNT(*)::int as c FROM design_cards WHERE status = 'concluidas'");
    const overdue = await pool.query("SELECT COUNT(*)::int as c FROM design_cards WHERE deadline < NOW() AND status NOT IN ('concluidas') AND deadline IS NOT NULL");
    const urgent = await pool.query("SELECT COUNT(*)::int as c FROM design_cards WHERE priority = 'urgente' AND status NOT IN ('concluidas')");
    const inAnalise = await pool.query("SELECT COUNT(*)::int as c FROM design_cards WHERE status = 'analise'");
    res.json({
      active: total.rows[0].c,
      done: done.rows[0].c,
      overdue: overdue.rows[0].c,
      urgent: urgent.rows[0].c,
      inAnalise: inAnalise.rows[0].c,
    });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Analytics (admin only)
app.get('/api/design/analytics', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    // Produtividade por designer — cards concluidos e tempo medio
    const perDesigner = await pool.query(`
      SELECT u.id, u.name,
        COUNT(c.id)::int as total_cards,
        COUNT(CASE WHEN c.status = 'concluidas' THEN 1 END)::int as completed,
        COUNT(CASE WHEN c.status NOT IN ('concluidas') THEN 1 END)::int as active,
        COUNT(CASE WHEN c.deadline < NOW() AND c.status NOT IN ('concluidas') AND c.deadline IS NOT NULL THEN 1 END)::int as overdue,
        COALESCE(ROUND(AVG(CASE WHEN c.status = 'concluidas' AND c.updated_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 3600 END)::numeric, 1), 0) as avg_hours_to_complete,
        COALESCE(SUM(c.estimated_hours) FILTER (WHERE c.status = 'concluidas'), 0)::numeric(10,1) as total_estimated_hours
      FROM users u
      LEFT JOIN design_cards c ON c.designer_id = u.id
      WHERE u.role IN ('designer', 'design_admin') AND u.active = true
      GROUP BY u.id, u.name ORDER BY completed DESC
    `);

    // Cards concluidos por semana (ultimas 8 semanas)
    const weeklyOutput = await pool.query(`
      SELECT DATE_TRUNC('week', c.updated_at)::date as week,
        COUNT(*)::int as count,
        u.name as designer_name
      FROM design_cards c
      JOIN users u ON c.designer_id = u.id
      WHERE c.status = 'concluidas' AND c.updated_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week, u.name ORDER BY week
    `);

    // Distribuicao por status
    const byStatus = await pool.query(`
      SELECT status, COUNT(*)::int as count FROM design_cards GROUP BY status ORDER BY count DESC
    `);

    // Distribuicao por prioridade
    const byPriority = await pool.query(`
      SELECT priority, COUNT(*)::int as count FROM design_cards WHERE status NOT IN ('concluidas') GROUP BY priority
    `);

    // Distribuicao por tipo de entrega
    const byType = await pool.query(`
      SELECT COALESCE(delivery_type, 'Sem tipo') as delivery_type, COUNT(*)::int as count
      FROM design_cards GROUP BY delivery_type ORDER BY count DESC
    `);

    // Quantidade de alteracoes (retrabalho) por designer
    const rework = await pool.query(`
      SELECT u.name, COUNT(*)::int as alteracoes
      FROM design_history h
      JOIN design_cards c ON h.card_id = c.id
      JOIN users u ON c.designer_id = u.id
      WHERE h.to_status = 'alteracoes'
      GROUP BY u.name ORDER BY alteracoes DESC
    `);

    // Top 5 cards mais lentos (concluidos)
    const slowest = await pool.query(`
      SELECT c.title, u.name as designer_name,
        ROUND(EXTRACT(EPOCH FROM (c.updated_at - c.created_at)) / 3600)::int as hours_taken,
        c.estimated_hours
      FROM design_cards c
      LEFT JOIN users u ON c.designer_id = u.id
      WHERE c.status = 'concluidas' AND c.updated_at IS NOT NULL
      ORDER BY (c.updated_at - c.created_at) DESC LIMIT 5
    `);

    res.json({
      perDesigner: perDesigner.rows,
      weeklyOutput: weeklyOutput.rows,
      byStatus: byStatus.rows,
      byPriority: byPriority.rows,
      byType: byType.rows,
      rework: rework.rows,
      slowest: slowest.rows,
    });
  } catch (err) { console.error('Analytics error:', err); res.status(500).json({ error: 'Erro ao gerar analytics' }); }
});

// ─── Serve static in production ───
app.use(express.static('dist'));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile('dist/index.html', { root: '.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
