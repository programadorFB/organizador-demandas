import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
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
app.use(express.urlencoded({ extended: true }));

// Garantir que pasta de uploads exista
if (!existsSync('uploads')) mkdirSync('uploads', { recursive: true });

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

// Listar admins para redirecionamento de demandas
app.get('/api/demands/admins', authMiddleware, roleMiddleware('admin', 'design_admin', 'sales_admin'), async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role FROM users WHERE role IN ('admin','design_admin','sales_admin') AND active = true ORDER BY name");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro ao listar admins' }); }
});

// Redirecionar demanda para outro admin
app.patch('/api/demands/:id/redirect', authMiddleware, roleMiddleware('admin', 'design_admin', 'sales_admin'), async (req, res) => {
  try {
    const { admin_id } = req.body;
    if (admin_id) {
      const adm = await pool.query("SELECT id FROM users WHERE id = $1 AND role IN ('admin','design_admin','sales_admin') AND active = true", [admin_id]);
      if (!adm.rows.length) return res.status(400).json({ error: 'Admin inválido' });
    }
    const result = await pool.query(
      `UPDATE demands SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [admin_id || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Demanda não encontrada' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao redirecionar' }); }
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
    const { status, priority, category, sprint_id, assigned_to } = req.query;
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
    if (assigned_to) { query += ` AND d.assigned_to = $${idx++}`; params.push(assigned_to); }

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
    if (!['admin', 'supervisor', 'user', 'designer', 'design_admin', 'sales_admin', 'vendedora'].includes(role)) {
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

// Helper: notificar admins do design
async function notifyDesignAdmins(excludeUserId, cardId, message, type) {
  const admins = await pool.query("SELECT id FROM users WHERE role IN ('admin','design_admin') AND id != $1 AND active = true", [excludeUserId]);
  for (const adm of admins.rows) {
    await pool.query('INSERT INTO design_notifications (user_id, card_id, message, type) VALUES ($1,$2,$3,$4)', [adm.id, cardId, message, type]);
  }
}

// Avatar
app.post('/api/design/avatar', authMiddleware, roleMiddleware(...designAccess), upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    // Remover avatar antigo
    const old = (await pool.query('SELECT avatar FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (old?.avatar) { try { unlinkSync(`uploads/${old.avatar}`); } catch {} }
    await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [req.file.filename, req.user.id]);
    res.json({ avatar: req.file.filename });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao salvar avatar' }); }
});

app.delete('/api/design/avatar', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const old = (await pool.query('SELECT avatar FROM users WHERE id=$1', [req.user.id])).rows[0];
    if (old?.avatar) { try { unlinkSync(`uploads/${old.avatar}`); } catch {} }
    await pool.query('UPDATE users SET avatar = NULL WHERE id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// User visual preferences (bg_image, bg_effect, accent_color)
app.get('/api/design/preferences', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query('SELECT bg_image, bg_effect, accent_color FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0] || { bg_image: null, bg_effect: 'none', accent_color: null });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.patch('/api/design/preferences', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { bg_image, bg_effect, accent_color } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (bg_image !== undefined) { fields.push(`bg_image = $${idx++}`); values.push(bg_image || null); }
    if (bg_effect !== undefined) { fields.push(`bg_effect = $${idx++}`); values.push(bg_effect || 'none'); }
    if (accent_color !== undefined) {
      const valid = accent_color === null
        || /^#[0-9a-fA-F]{6}$/.test(accent_color)
        || /^anime:[a-z0-9]{2,16}$/.test(accent_color);
      if (!valid) return res.status(400).json({ error: 'accent_color inválido' });
      fields.push(`accent_color = $${idx++}`); values.push(accent_color);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });
    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Designers list
app.get('/api/design/designers', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, active, avatar FROM users WHERE role IN ('designer','design_admin') AND active = true ORDER BY name");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro ao listar designers' }); }
});

// Cards list
app.get('/api/design/cards', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { status, designer_id } = req.query;
    let query = `
      SELECT c.*, d.name as designer_name, d.avatar as designer_avatar, cb.name as created_by_name,
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
    // Designers see their own cards + cards visible to all, in their columns
    if (req.user.role === 'designer') {
      query += ` AND (c.designer_id = $${idx++} OR c.visible_to_all = true)`; params.push(req.user.id);
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
    const item = result.rows[0];
    if (item.checked) {
      const card = (await pool.query('SELECT title FROM design_cards WHERE id=$1', [item.card_id])).rows[0];
      const userName = (await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0]?.name;
      const sectionLabel = item.section ? ` [${item.section}]` : '';
      await notifyDesignAdmins(req.user.id, item.card_id, `${userName} concluiu "${item.text}"${sectionLabel} em "${card?.title}"`, 'checklist');
    }
    res.json(item);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/design/checklist/:id', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    await pool.query('DELETE FROM design_checklist WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Reorder checklist items
app.patch('/api/design/checklist/reorder', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items é obrigatório' });
    for (const item of items) {
      await pool.query('UPDATE design_checklist SET sort_order = $1, section = $2 WHERE id = $3', [item.sort_order, item.section ?? null, item.id]);
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao reordenar' }); }
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
    // Notificar admins
    const card = (await pool.query('SELECT title FROM design_cards WHERE id=$1', [req.params.id])).rows[0];
    const userName = (await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0]?.name;
    const preview = content.length > 60 ? content.slice(0, 60) + '...' : content;
    await notifyDesignAdmins(req.user.id, parseInt(req.params.id), `${userName} comentou em "${card?.title}": ${preview}`, 'comentario');
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

// ─── Experts (gerenciáveis pelo design_admin) ───
app.get('/api/design/experts', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const includeInactive = req.query.all === '1';
    const query = includeInactive
      ? 'SELECT id, name, active, sort_order FROM design_experts ORDER BY sort_order, name'
      : 'SELECT id, name, active, sort_order FROM design_experts WHERE active = true ORDER BY sort_order, name';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao listar experts' }); }
});

app.post('/api/design/experts', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const name = (req.body?.name || '').trim().toUpperCase();
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    if (name.length > 80) return res.status(400).json({ error: 'Nome muito longo (máx 80)' });
    const dup = await pool.query('SELECT id FROM design_experts WHERE name = $1', [name]);
    if (dup.rows.length) return res.status(409).json({ error: 'Expert já cadastrado' });
    const next = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS s FROM design_experts');
    const result = await pool.query(
      'INSERT INTO design_experts (name, sort_order, created_by) VALUES ($1, $2, $3) RETURNING id, name, active, sort_order',
      [name, next.rows[0].s, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro ao criar expert' }); }
});

app.patch('/api/design/experts/:id/toggle-active', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE design_experts SET active = NOT active WHERE id = $1 RETURNING id, name, active, sort_order',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Expert não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/design/experts/:id', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const used = await pool.query(
      'SELECT 1 FROM design_cards c JOIN design_experts e ON c.expert_name = e.name WHERE e.id = $1 LIMIT 1',
      [req.params.id]
    );
    if (used.rows.length) return res.status(409).json({ error: 'Expert está em uso por demandas. Desative em vez de excluir.' });
    const result = await pool.query('DELETE FROM design_experts WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Expert não encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Toggle visible to all
app.patch('/api/design/cards/:id/visible', authMiddleware, roleMiddleware(...designAdmin), async (req, res) => {
  try {
    const result = await pool.query('UPDATE design_cards SET visible_to_all = NOT visible_to_all, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Links de referência
app.get('/api/design/cards/:id/links', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT l.*, u.name as user_name FROM design_links l JOIN users u ON l.user_id = u.id WHERE l.card_id = $1 ORDER BY l.sort_order, l.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/design/cards/:id/links', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { url, label } = req.body;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });
    const result = await pool.query('INSERT INTO design_links (card_id, user_id, url, label) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.user.id, url, label || null]);
    // Notificar admins
    const card = (await pool.query('SELECT title FROM design_cards WHERE id=$1', [req.params.id])).rows[0];
    const userName = (await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0]?.name;
    await notifyDesignAdmins(req.user.id, parseInt(req.params.id), `${userName} adicionou link em "${card?.title}": ${label || url}`, 'link');
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/design/links/:id', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const link = (await pool.query('SELECT * FROM design_links WHERE id=$1', [req.params.id])).rows[0];
    if (!link) return res.status(404).json({ error: 'Link não encontrado' });
    if (link.user_id !== req.user.id && !designAdmin.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    await pool.query('DELETE FROM design_links WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// Reorder links
app.patch('/api/design/links/reorder', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items é obrigatório' });
    for (const item of items) {
      await pool.query('UPDATE design_links SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao reordenar' }); }
});

// Design Attachments
app.get('/api/design/cards/:id/attachments', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name FROM design_attachments a
       JOIN users u ON a.user_id = u.id WHERE a.card_id = $1 ORDER BY a.sort_order, a.created_at DESC`,
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
    // Notificar admins
    const card = (await pool.query('SELECT title FROM design_cards WHERE id=$1', [req.params.id])).rows[0];
    const userName = (await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])).rows[0]?.name;
    const fileNames = req.files.map(f => f.originalname).join(', ');
    await notifyDesignAdmins(req.user.id, parseInt(req.params.id), `${userName} anexou ${req.files.length} arquivo(s) em "${card?.title}": ${fileNames}`, 'anexo');
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

// Reorder attachments
app.patch('/api/design/attachments/reorder', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items é obrigatório' });
    for (const item of items) {
      await pool.query('UPDATE design_attachments SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao reordenar' }); }
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

// Video production stats (monthly)
app.get('/api/design/video-stats', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = await pool.query(
      `SELECT COUNT(*)::int as total FROM design_checklist cl
       JOIN design_cards c ON cl.card_id = c.id
       WHERE cl.created_at >= $1`,
      [monthStart]
    );

    const perEditor = await pool.query(
      `SELECT u.id, u.name, u.avatar, COUNT(cl.id)::int as count
       FROM design_checklist cl
       JOIN design_cards c ON cl.card_id = c.id
       JOIN users u ON c.designer_id = u.id
       WHERE cl.created_at >= $1
       GROUP BY u.id, u.name, u.avatar
       ORDER BY count DESC`,
      [monthStart]
    );

    const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    res.json({
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      total: total.rows[0].total,
      perEditor: perEditor.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erro' }); }
});

// Expert video stats — historico mensal completo
app.get('/api/design/expert-video-stats', authMiddleware, roleMiddleware(...designAccess), async (req, res) => {
  try {
    // Contagem por expert por mes
    const perExpertMonth = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', cl.created_at), 'YYYY-MM') as month_key,
        TO_CHAR(DATE_TRUNC('month', cl.created_at), 'TMMonth YYYY') as month_label,
        c.expert_name,
        COUNT(cl.id)::int as video_count
      FROM design_checklist cl
      JOIN design_cards c ON cl.card_id = c.id
      WHERE c.expert_name IS NOT NULL AND c.expert_name != ''
      GROUP BY month_key, month_label, c.expert_name
      ORDER BY month_key DESC, video_count DESC
    `);

    // Resumo por mes
    const monthlySummary = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', cl.created_at), 'YYYY-MM') as month_key,
        TO_CHAR(DATE_TRUNC('month', cl.created_at), 'TMMonth YYYY') as month_label,
        COUNT(DISTINCT c.expert_name)::int as total_experts,
        COUNT(cl.id)::int as total_videos
      FROM design_checklist cl
      JOIN design_cards c ON cl.card_id = c.id
      WHERE c.expert_name IS NOT NULL AND c.expert_name != ''
      GROUP BY month_key, month_label
      ORDER BY month_key DESC
    `);

    // Agrupar dados por mes
    const months = {};
    monthlySummary.rows.forEach(row => {
      months[row.month_key] = {
        month_key: row.month_key,
        month_label: row.month_label.charAt(0).toUpperCase() + row.month_label.slice(1),
        total_experts: row.total_experts,
        total_videos: row.total_videos,
        experts: [],
      };
    });

    perExpertMonth.rows.forEach(row => {
      if (months[row.month_key]) {
        months[row.month_key].experts.push({
          expert_name: row.expert_name,
          video_count: row.video_count,
        });
      }
    });

    res.json({ months: Object.values(months) });
  } catch (err) { console.error('Expert video stats error:', err); res.status(500).json({ error: 'Erro' }); }
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

// ─── Sales Panel (Sara & Vendedoras) ───
const salesAdmin = ['admin', 'sales_admin'];
const salesAccess = ['admin', 'sales_admin', 'vendedora'];

// Listar vendedoras (Sara vê todas)
app.get('/api/sales/sellers', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name, u.email, u.avatar
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      ORDER BY u.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar vendedoras' });
  }
});

// Adicionar vendedora
app.post('/api/sales/sellers', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { name, email, password, shift, goal_leads, goal_sales, goal_revenue } = req.body;
    // Criar usuário se não existir (ou usar existente)
    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (userResult.rows.length) {
      userId = userResult.rows[0].id;
      await pool.query("UPDATE users SET role = 'vendedora' WHERE id = $1", [userId]);
    } else {
      const hash = await bcrypt.hash(password || '123456', 10);
      userResult = await pool.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'vendedora') RETURNING id",
        [name, email, hash]
      );
      userId = userResult.rows[0].id;
    }
    // Criar perfil de vendedora
    const result = await pool.query(
      `INSERT INTO sellers (user_id, shift, monthly_goal_leads, monthly_goal_sales, monthly_goal_revenue)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET shift=$2, monthly_goal_leads=$3, monthly_goal_sales=$4, monthly_goal_revenue=$5, active=true, updated_at=NOW()
       RETURNING *`,
      [userId, shift || 'completo', goal_leads || 0, goal_sales || 0, goal_revenue || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar vendedora' });
  }
});

// Alternar status da vendedora
app.patch('/api/sales/sellers/:id/toggle-active', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE sellers SET active = NOT active, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
});

// Enviar relatório (Vendedora)
app.post('/api/sales/reports', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const { report_date, report_type, leads_received, leads_responded, conversions, sales_closed, revenue, notes } = req.body;
    // Buscar ID da vendedora pelo user_id logado
    const seller = await pool.query('SELECT id FROM sellers WHERE user_id = $1 AND active = true', [req.user.id]);
    if (!seller.rows.length) return res.status(403).json({ error: 'Perfil de vendedora não encontrado ou inativo' });
    const sellerId = seller.rows[0].id;

    const result = await pool.query(
      `INSERT INTO sales_reports (seller_id, report_date, report_type, leads_received, leads_responded, conversions, sales_closed, revenue, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (seller_id, report_date, report_type)
       DO UPDATE SET leads_received=$4, leads_responded=$5, conversions=$6, sales_closed=$7, revenue=$8, notes=$9, updated_at=NOW()
       RETURNING *`,
      [sellerId, report_date || new Date(), report_type, leads_received || 0, leads_responded || 0, conversions || 0, sales_closed || 0, revenue || 0, notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao enviar relatório' });
  }
});

// Stats Sara (Geral)
app.get('/api/sales/stats', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { date, shift } = req.query;
    const filterDate = date || new Date().toISOString().split('T')[0];

    // Stats diárias por vendedora
    const daily = await pool.query(`
      SELECT s.id as seller_id, u.name, u.avatar,
        COALESCE(SUM(r.leads_received), 0)::int as leads_received,
        COALESCE(SUM(r.leads_responded), 0)::int as leads_responded,
        COALESCE(SUM(r.conversions), 0)::int as conversions,
        COALESCE(SUM(r.sales_closed), 0)::int as sales_closed,
        COALESCE(SUM(r.revenue), 0)::numeric(12,2) as revenue,
        CASE WHEN COALESCE(SUM(r.leads_received), 0) > 0
          THEN ROUND((SUM(r.sales_closed)::numeric / SUM(r.leads_received)) * 100, 1)
          ELSE 0 END as conversion_rate
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sales_reports r ON s.id = r.seller_id AND r.report_date = $1
      WHERE s.active = true ${shift ? 'AND r.report_type = $2' : ''}
      GROUP BY s.id, u.name, u.avatar
      ORDER BY revenue DESC
    `, shift ? [filterDate, shift] : [filterDate]);

    // Stats mensais
    const monthly = await pool.query(`
      SELECT s.id as seller_id,
        COALESCE(SUM(r.leads_received), 0)::int as leads_received,
        COALESCE(SUM(r.sales_closed), 0)::int as sales_closed,
        COALESCE(SUM(r.revenue), 0)::numeric(12,2) as revenue,
        s.monthly_goal_revenue
      FROM sellers s
      LEFT JOIN sales_reports r ON s.id = r.seller_id
        AND r.report_date >= DATE_TRUNC('month', $1::date)
        AND r.report_date <= (DATE_TRUNC('month', $1::date) + INTERVAL '1 month - 1 day')
      WHERE s.active = true
      GROUP BY s.id, s.monthly_goal_revenue
    `, [filterDate]);

    // Totais gerais do dia
    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(r.leads_received), 0)::int as total_leads,
        COALESCE(SUM(r.sales_closed), 0)::int as total_sales,
        COALESCE(SUM(r.revenue), 0)::numeric(12,2) as total_revenue
      FROM sales_reports r
      WHERE r.report_date = $1 ${shift ? 'AND r.report_type = $2' : ''}
    `, shift ? [filterDate, shift] : [filterDate]);

    // ─── Performance Alerts (inteligentes) ───
    const now = new Date();
    const currentHour = now.getHours();
    let alerts = [];

    // 1. Relatórios pendentes
    if (filterDate === now.toISOString().split('T')[0]) {
      if (currentHour >= 14) {
        const missingManha = await pool.query(`
          SELECT u.name FROM sellers s JOIN users u ON s.user_id = u.id
          WHERE s.active = true AND NOT EXISTS (
            SELECT 1 FROM sales_reports r WHERE r.seller_id = s.id AND r.report_date = CURRENT_DATE AND r.report_type = 'manha'
          )`, []);
        missingManha.rows.forEach(m => alerts.push({ type: 'warning', msg: `${m.name} ainda nao enviou relatorio da manha` }));
      }
      if (currentHour >= 18) {
        const missingCompleto = await pool.query(`
          SELECT u.name FROM sellers s JOIN users u ON s.user_id = u.id
          WHERE s.active = true AND s.shift = 'completo' AND NOT EXISTS (
            SELECT 1 FROM sales_reports r WHERE r.seller_id = s.id AND r.report_date = CURRENT_DATE AND r.report_type = 'completo'
          )`, []);
        missingCompleto.rows.forEach(m => alerts.push({ type: 'warning', msg: `${m.name} ainda nao enviou relatorio completo` }));
      }
    }

    // 2. Conversão baixa (< 12%) e taxa de resposta baixa (< 80%)
    daily.rows.forEach(s => {
      if (s.leads_received >= 10) {
        if (parseFloat(s.conversion_rate) < 12) {
          alerts.push({ type: 'danger', msg: `${s.name} com conversao baixa hoje: ${s.conversion_rate}% (meta: 15%)` });
        }
        const respRate = ((s.leads_responded / s.leads_received) * 100).toFixed(1);
        if (parseFloat(respRate) < 80) {
          alerts.push({ type: 'danger', msg: `${s.name} respondeu apenas ${respRate}% dos leads hoje (minimo: 85%)` });
        }
      }
    });

    // 3. Ritmo mensal abaixo da meta (projeção)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = new Date(filterDate).getDate();
    const expectedPct = (currentDay / daysInMonth) * 100;
    monthly.rows.forEach(ms => {
      if (parseFloat(ms.monthly_goal_revenue) > 0) {
        const pct = (parseFloat(ms.revenue) / parseFloat(ms.monthly_goal_revenue)) * 100;
        if (pct < expectedPct * 0.6 && currentDay >= 10) {
          alerts.push({ type: 'danger', msg: `Vendedora ID ${ms.seller_id} atingiu ${pct.toFixed(0)}% da meta mensal (esperado ~${expectedPct.toFixed(0)}%)` });
        }
        if (pct >= 90) {
          alerts.push({ type: 'success', msg: `Vendedora ID ${ms.seller_id} ja atingiu ${pct.toFixed(0)}% da meta mensal!` });
        }
      }
    });

    // 4. Destaques positivos do dia
    daily.rows.forEach(s => {
      if (s.leads_received >= 10 && parseFloat(s.conversion_rate) >= 25) {
        alerts.push({ type: 'success', msg: `${s.name} com excelente conversao hoje: ${s.conversion_rate}%!` });
      }
    });

    res.json({
      daily: daily.rows,
      monthly: monthly.rows,
      totals: totals.rows[0],
      alerts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar stats de vendas' });
  }
});

// Individual Stats (Vendedora)
app.get('/api/sales/seller/dashboard', authMiddleware, roleMiddleware('vendedora', 'admin'), async (req, res) => {
  try {
    const seller = await pool.query('SELECT * FROM sellers WHERE user_id = $1', [req.user.id]);
    if (!seller.rows.length) return res.status(404).json({ error: 'Vendedora não encontrada' });
    const s = seller.rows[0];

    // Stats do mês atual
    const monthly = await pool.query(`
      SELECT
        COALESCE(SUM(leads_received), 0)::int as leads,
        COALESCE(SUM(leads_responded), 0)::int as responded,
        COALESCE(SUM(conversions), 0)::int as conversions,
        COALESCE(SUM(sales_closed), 0)::int as sales,
        COALESCE(SUM(revenue), 0)::numeric(12,2) as revenue
      FROM sales_reports
      WHERE seller_id = $1
        AND report_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND report_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')
    `, [s.id]);

    // Histórico recente (últimos 10 relatórios)
    const history = await pool.query(`
      SELECT * FROM sales_reports WHERE seller_id = $1 ORDER BY report_date DESC, report_type DESC LIMIT 10
    `, [s.id]);

    res.json({
      seller: s,
      monthly: monthly.rows[0],
      history: history.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar dashboard da vendedora' });
  }
});

// Resumo mensal geral (Sara)
app.get('/api/sales/monthly-summary', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month || (new Date().getMonth() + 1);
    const y = year || new Date().getFullYear();

    const summary = await pool.query(`
      SELECT s.id as seller_id, u.name,
        COALESCE(SUM(r.leads_received), 0)::int as leads_received,
        COALESCE(SUM(r.leads_responded), 0)::int as leads_responded,
        COALESCE(SUM(r.conversions), 0)::int as conversions,
        COALESCE(SUM(r.sales_closed), 0)::int as sales_closed,
        COALESCE(SUM(r.revenue), 0)::numeric(12,2) as revenue,
        CASE WHEN COALESCE(SUM(r.leads_received), 0) > 0
          THEN ROUND((SUM(r.sales_closed)::numeric / SUM(r.leads_received)) * 100, 1)
          ELSE 0 END as conversion_rate,
        COUNT(DISTINCT r.report_date)::int as days_reported,
        s.monthly_goal_leads, s.monthly_goal_sales, s.monthly_goal_revenue
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN sales_reports r ON s.id = r.seller_id
        AND EXTRACT(MONTH FROM r.report_date) = $1
        AND EXTRACT(YEAR FROM r.report_date) = $2
      WHERE s.active = true
      GROUP BY s.id, u.name, s.monthly_goal_leads, s.monthly_goal_sales, s.monthly_goal_revenue
      ORDER BY revenue DESC
    `, [m, y]);

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(r.leads_received), 0)::int as total_leads,
        COALESCE(SUM(r.leads_responded), 0)::int as total_responded,
        COALESCE(SUM(r.conversions), 0)::int as total_conversions,
        COALESCE(SUM(r.sales_closed), 0)::int as total_sales,
        COALESCE(SUM(r.revenue), 0)::numeric(12,2) as total_revenue
      FROM sales_reports r
      JOIN sellers s ON r.seller_id = s.id
      WHERE s.active = true
        AND EXTRACT(MONTH FROM r.report_date) = $1
        AND EXTRACT(YEAR FROM r.report_date) = $2
    `, [m, y]);

    res.json({ sellers: summary.rows, totals: totals.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar resumo mensal' });
  }
});

// Atualizar metas da vendedora (Sara)
app.patch('/api/sales/sellers/:id/goals', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { goal_leads, goal_sales, goal_revenue } = req.body;
    const result = await pool.query(
      `UPDATE sellers SET monthly_goal_leads = $1, monthly_goal_sales = $2, monthly_goal_revenue = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [goal_leads || 0, goal_sales || 0, goal_revenue || 0, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar metas' });
  }
});

// Remover vendedora (desativar user + seller)
app.delete('/api/sales/sellers/:id', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const seller = await pool.query('SELECT user_id FROM sellers WHERE id = $1', [req.params.id]);
    if (!seller.rows.length) return res.status(404).json({ error: 'Vendedora não encontrada' });
    await pool.query('UPDATE sellers SET active = false WHERE id = $1', [req.params.id]);
    await pool.query("UPDATE users SET active = false WHERE id = $1", [seller.rows[0].user_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover vendedora' });
  }
});

// Listar relatórios de uma vendedora (admin)
app.get('/api/sales/sellers/:id/reports', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year, limit } = req.query;
    const m = month || (new Date().getMonth() + 1);
    const y = year || new Date().getFullYear();
    const lim = Math.min(parseInt(limit) || 100, 500);

    const seller = await pool.query(
      `SELECT s.*, u.name, u.email FROM sellers s JOIN users u ON s.user_id = u.id WHERE s.id = $1`,
      [id]
    );
    if (!seller.rows.length) return res.status(404).json({ error: 'Vendedora não encontrada' });

    const reports = await pool.query(
      `SELECT * FROM sales_reports
       WHERE seller_id = $1
         AND EXTRACT(MONTH FROM report_date) = $2
         AND EXTRACT(YEAR FROM report_date) = $3
       ORDER BY report_date DESC, report_type DESC
       LIMIT $4`,
      [id, m, y, lim]
    );

    const totals = await pool.query(
      `SELECT
        COALESCE(SUM(leads_received), 0)::int as total_leads,
        COALESCE(SUM(leads_responded), 0)::int as total_responded,
        COALESCE(SUM(conversions), 0)::int as total_conversions,
        COALESCE(SUM(sales_closed), 0)::int as total_sales,
        COALESCE(SUM(revenue), 0)::numeric(12,2) as total_revenue,
        COUNT(DISTINCT report_date)::int as days_reported
       FROM sales_reports
       WHERE seller_id = $1
         AND EXTRACT(MONTH FROM report_date) = $2
         AND EXTRACT(YEAR FROM report_date) = $3`,
      [id, m, y]
    );

    res.json({
      seller: seller.rows[0],
      reports: reports.rows,
      totals: totals.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar relatórios da vendedora' });
  }
});

// Listar relatórios da vendedora (ela mesma)
app.get('/api/sales/my-reports', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const seller = await pool.query('SELECT id FROM sellers WHERE user_id = $1', [req.user.id]);
    if (!seller.rows.length) return res.status(404).json({ error: 'Vendedora não encontrada' });
    const { limit } = req.query;
    const result = await pool.query(
      `SELECT * FROM sales_reports WHERE seller_id = $1 ORDER BY report_date DESC, report_type DESC LIMIT $2`,
      [seller.rows[0].id, limit || 30]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar relatórios' });
  }
});

// ─── Sales Chat (Grupo Interno) ───

// Listar mensagens (paginado)
app.get('/api/sales/chat', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const { before, limit } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 100);
    let query = `
      SELECT m.*, u.name as user_name, u.role as user_role,
        rm.content as reply_content, ru.name as reply_user_name
      FROM sales_chat_messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN sales_chat_messages rm ON m.reply_to = rm.id
      LEFT JOIN users ru ON rm.user_id = ru.id
      WHERE m.deleted = false
    `;
    const params = [];
    if (before) {
      params.push(before);
      query += ` AND m.id < $${params.length}`;
    }
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(lim);

    const result = await pool.query(query, params);
    res.json(result.rows.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
});

// Enviar mensagem
app.post('/api/sales/chat', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const { content, reply_to } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Mensagem vazia' });
    const result = await pool.query(
      `INSERT INTO sales_chat_messages (user_id, content, reply_to) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, content.trim(), reply_to || null]
    );
    const msg = await pool.query(
      `SELECT m.*, u.name as user_name, u.role as user_role FROM sales_chat_messages m JOIN users u ON m.user_id = u.id WHERE m.id = $1`,
      [result.rows[0].id]
    );
    res.status(201).json(msg.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Novas mensagens desde ID (polling)
app.get('/api/sales/chat/new', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const { after } = req.query;
    if (!after) return res.json([]);
    const result = await pool.query(
      `SELECT m.*, u.name as user_name, u.role as user_role,
        rm.content as reply_content, ru.name as reply_user_name
       FROM sales_chat_messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN sales_chat_messages rm ON m.reply_to = rm.id
       LEFT JOIN users ru ON rm.user_id = ru.id
       WHERE m.id > $1 AND m.deleted = false
       ORDER BY m.created_at ASC`,
      [after]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar novas mensagens' });
  }
});

// Editar mensagem (autor ou admin)
app.patch('/api/sales/chat/:id', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const msg = await pool.query('SELECT * FROM sales_chat_messages WHERE id = $1', [req.params.id]);
    if (!msg.rows.length) return res.status(404).json({ error: 'Mensagem não encontrada' });
    if (msg.rows[0].user_id !== req.user.id && !salesAdmin.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { content } = req.body;
    const result = await pool.query(
      `UPDATE sales_chat_messages SET content=$1, edited=true, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [content, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar' });
  }
});

// Deletar mensagem (autor ou admin)
app.delete('/api/sales/chat/:id', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const msg = await pool.query('SELECT * FROM sales_chat_messages WHERE id = $1', [req.params.id]);
    if (!msg.rows.length) return res.status(404).json({ error: 'Mensagem não encontrada' });
    if (msg.rows[0].user_id !== req.user.id && !salesAdmin.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    await pool.query('UPDATE sales_chat_messages SET deleted=true, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar' });
  }
});

// Fixar/desfixar mensagem (admin)
app.patch('/api/sales/chat/:id/pin', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE sales_chat_messages SET pinned = NOT pinned, updated_at=NOW() WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fixar' });
  }
});

// Mensagens fixadas
app.get('/api/sales/chat/pinned', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, u.name as user_name FROM sales_chat_messages m JOIN users u ON m.user_id = u.id
       WHERE m.pinned = true AND m.deleted = false ORDER BY m.updated_at DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar fixadas' });
  }
});

// Contagem de não lidas
app.get('/api/sales/chat/unread', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const read = await pool.query('SELECT last_read_at FROM sales_chat_reads WHERE user_id = $1', [req.user.id]);
    const lastRead = read.rows[0]?.last_read_at || new Date(0);
    const count = await pool.query(
      'SELECT COUNT(*)::int as count FROM sales_chat_messages WHERE created_at > $1 AND deleted = false AND user_id != $2',
      [lastRead, req.user.id]
    );
    res.json({ unread: count.rows[0].count });
  } catch (err) {
    res.json({ unread: 0 });
  }
});

// Marcar como lido
app.patch('/api/sales/chat/mark-read', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO sales_chat_reads (user_id, last_read_at) VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET last_read_at = NOW()`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro' });
  }
});

// ─── Knowledge Base (Banco de Conhecimento) ───

// Listar categorias
app.get('/api/knowledge/categories', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(a.id)::int as article_count
       FROM knowledge_categories c
       LEFT JOIN knowledge_articles a ON c.id = a.category_id AND a.published = true
       GROUP BY c.id ORDER BY c.sort_order`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar categorias' });
  }
});

// CRUD categorias (admin)
app.post('/api/knowledge/categories', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    const result = await pool.query(
      'INSERT INTO knowledge_categories (name, icon, color) VALUES ($1, $2, $3) RETURNING *',
      [name, icon || '', color || '#6c5ce7']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

app.delete('/api/knowledge/categories/:id', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    await pool.query('DELETE FROM knowledge_categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
});

// Listar artigos
app.get('/api/knowledge/articles', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    const { category_id, search, pinned } = req.query;
    let query = `
      SELECT a.*, u.name as author_name, c.name as category_name, c.color as category_color
      FROM knowledge_articles a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN knowledge_categories c ON a.category_id = c.id
      WHERE a.published = true
    `;
    const params = [];
    if (category_id) { params.push(category_id); query += ` AND a.category_id = $${params.length}`; }
    if (pinned === 'true') query += ' AND a.pinned = true';
    if (search) { params.push(`%${search}%`); query += ` AND (a.title ILIKE $${params.length} OR a.content ILIKE $${params.length})`; }
    query += ' ORDER BY a.pinned DESC, a.updated_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar artigos' });
  }
});

// Obter artigo (incrementa views)
app.get('/api/knowledge/articles/:id', authMiddleware, roleMiddleware(...salesAccess), async (req, res) => {
  try {
    await pool.query('UPDATE knowledge_articles SET views = views + 1 WHERE id = $1', [req.params.id]);
    const result = await pool.query(
      `SELECT a.*, u.name as author_name, c.name as category_name, c.color as category_color
       FROM knowledge_articles a JOIN users u ON a.author_id = u.id
       LEFT JOIN knowledge_categories c ON a.category_id = c.id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Artigo não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar artigo' });
  }
});

// Criar artigo (admin)
app.post('/api/knowledge/articles', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { title, content, category_id, pinned } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo obrigatórios' });
    const result = await pool.query(
      `INSERT INTO knowledge_articles (title, content, category_id, author_id, pinned)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, content, category_id || null, req.user.id, pinned || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar artigo' });
  }
});

// Editar artigo (admin)
app.put('/api/knowledge/articles/:id', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { title, content, category_id, pinned, published } = req.body;
    const result = await pool.query(
      `UPDATE knowledge_articles SET title=$1, content=$2, category_id=$3, pinned=$4, published=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, content, category_id || null, pinned || false, published !== false, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar artigo' });
  }
});

// Deletar artigo (admin)
app.delete('/api/knowledge/articles/:id', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    await pool.query('DELETE FROM knowledge_articles WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar artigo' });
  }
});

// ─── Kommo CRM Integration ───

// Helper: fazer request na API Kommo
async function kommoRequest(method, endpoint, body = null) {
  const cfg = await pool.query('SELECT * FROM kommo_config LIMIT 1');
  if (!cfg.rows.length || !cfg.rows[0].access_token) throw new Error('Kommo não configurado');
  const config = cfg.rows[0];

  // Verificar se token expirou e renovar
  if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
    await refreshKommoToken(config);
    const updated = await pool.query('SELECT * FROM kommo_config LIMIT 1');
    Object.assign(config, updated.rows[0]);
  }

  const url = `https://${config.subdomain}.kommo.com/api/v4${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  if (res.status === 429) throw new Error('Rate limit Kommo (7 req/s). Tente novamente.');
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Kommo API ${res.status}: ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function refreshKommoToken(config) {
  const res = await fetch(`https://${config.subdomain}.kommo.com/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.client_id,
      client_secret: config.client_secret,
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
      redirect_uri: config.redirect_uri,
    }),
  });
  if (!res.ok) throw new Error('Falha ao renovar token Kommo');
  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await pool.query(
    `UPDATE kommo_config SET access_token=$1, refresh_token=$2, token_expires_at=$3, updated_at=NOW() WHERE id=$4`,
    [data.access_token, data.refresh_token, expiresAt, config.id]
  );
}

// Salvar/atualizar config Kommo
app.post('/api/kommo/config', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    let { subdomain, client_id, client_secret, redirect_uri } = req.body;
    if (!subdomain || !client_id || !client_secret) {
      return res.status(400).json({ error: 'Campos obrigatórios: subdomain, client_id, client_secret' });
    }
    // Normalizar subdomain: extrair só o nome (ex: "https://fuzabalta7d.kommo.com" -> "fuzabalta7d")
    subdomain = subdomain.replace(/^https?:\/\//, '').replace(/\.kommo\.com.*$/, '').replace(/\.amocrm\.com.*$/, '').trim();
    // Garantir redirect_uri com HTTPS
    const defaultRedirect = `https://${req.get('host')}/api/kommo/callback`;
    if (!redirect_uri) redirect_uri = defaultRedirect;
    else if (redirect_uri.startsWith('http://')) redirect_uri = redirect_uri.replace('http://', 'https://');

    const exists = await pool.query('SELECT id FROM kommo_config LIMIT 1');
    if (exists.rows.length) {
      await pool.query(
        `UPDATE kommo_config SET subdomain=$1, client_id=$2, client_secret=$3, redirect_uri=$4, updated_at=NOW() WHERE id=$5`,
        [subdomain, client_id, client_secret, redirect_uri, exists.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO kommo_config (subdomain, client_id, client_secret, redirect_uri) VALUES ($1, $2, $3, $4)`,
        [subdomain, client_id, client_secret, redirect_uri]
      );
    }
    const config = await pool.query('SELECT id, subdomain, client_id, redirect_uri, connected, pipeline_id, pipeline_name, stage_new_lead, stage_responded, stage_interested, stage_won, stage_lost, revenue_field_id, last_sync_at, sync_interval_minutes FROM kommo_config LIMIT 1');
    res.json(config.rows[0]);
  } catch (err) {
    console.error('Kommo config error:', err);
    res.status(500).json({ error: 'Erro ao salvar config Kommo' });
  }
});

// Obter config (sem secrets)
app.get('/api/kommo/config', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const config = await pool.query('SELECT id, subdomain, client_id, redirect_uri, connected, pipeline_id, pipeline_name, stage_new_lead, stage_responded, stage_interested, stage_won, stage_lost, revenue_field_id, last_sync_at, sync_interval_minutes FROM kommo_config LIMIT 1');
    res.json(config.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar config' });
  }
});

// OAuth2 callback - trocar code por tokens
app.get('/api/kommo/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Código de autorização ausente');

    const config = await pool.query('SELECT * FROM kommo_config LIMIT 1');
    if (!config.rows.length) return res.status(400).send('Kommo não configurado');
    const cfg = config.rows[0];

    const tokenRes = await fetch(`https://${cfg.subdomain}.kommo.com/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: cfg.redirect_uri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(400).send(`Erro ao obter token: ${err}`);
    }

    const data = await tokenRes.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    await pool.query(
      `UPDATE kommo_config SET access_token=$1, refresh_token=$2, token_expires_at=$3, connected=true, updated_at=NOW() WHERE id=$4`,
      [data.access_token, data.refresh_token, expiresAt, cfg.id]
    );

    // Redirecionar de volta para o painel
    res.send('<html><body><script>window.close(); window.opener && window.opener.postMessage("kommo_connected","*");</script><p>Kommo conectado! Pode fechar esta janela.</p></body></html>');
  } catch (err) {
    console.error('Kommo callback error:', err);
    res.status(500).send('Erro na autenticação Kommo');
  }
});

// Desconectar Kommo
app.post('/api/kommo/disconnect', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    await pool.query(`UPDATE kommo_config SET access_token=NULL, refresh_token=NULL, token_expires_at=NULL, connected=false, updated_at=NOW()`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// Listar pipelines do Kommo
app.get('/api/kommo/pipelines', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const data = await kommoRequest('GET', '/leads/pipelines');
    const pipelines = (data?._embedded?.pipelines || []).map(p => ({
      id: p.id,
      name: p.name,
      statuses: (p._embedded?.statuses || []).map(s => ({ id: s.id, name: s.name, color: s.color, sort: s.sort }))
    }));
    res.json(pipelines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar mapeamento de pipeline/stages
app.patch('/api/kommo/pipeline-config', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { pipeline_id, pipeline_name, stage_new_lead, stage_responded, stage_interested, stage_won, stage_lost, revenue_field_id } = req.body;
    await pool.query(
      `UPDATE kommo_config SET pipeline_id=$1, pipeline_name=$2, stage_new_lead=$3, stage_responded=$4, stage_interested=$5, stage_won=$6, stage_lost=$7, revenue_field_id=$8, updated_at=NOW()`,
      [pipeline_id, pipeline_name, stage_new_lead, stage_responded, stage_interested, stage_won, stage_lost, revenue_field_id || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar pipeline config' });
  }
});

// ─── Pipeline Stages ───

// Sincronizar stages de TODOS os pipelines da Kommo
app.post('/api/kommo/sync-stages', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const data = await kommoRequest('GET', '/leads/pipelines');
    const pipelines = data?._embedded?.pipelines || [];
    await pool.query('DELETE FROM kommo_pipeline_stages');
    let count = 0;
    for (const p of pipelines) {
      const statuses = p._embedded?.statuses || [];
      for (const s of statuses) {
        if (s.id === 142 || s.id === 143) continue; // Skip "Venda ganha/perdida" (sistema)
        await pool.query(
          `INSERT INTO kommo_pipeline_stages (pipeline_id, status_id, stage_name, stage_order, stage_color)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (status_id) DO UPDATE SET stage_name=$3, stage_order=$4, stage_color=$5`,
          [p.id, s.id, s.name, s.sort || 0, s.color || '#c1c1c1']
        );
        count++;
      }
    }
    res.json({ ok: true, pipelines: pipelines.length, stages: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar stages
app.get('/api/kommo/stages', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kommo_pipeline_stages ORDER BY pipeline_id, stage_order');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Contagem de leads agrupada por etapa (todas as pipelines)
app.get('/api/kommo/leads-by-stage', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ps.stage_name, ps.stage_color, ps.pipeline_id, ps.status_id, ps.stage_order,
        COUNT(lc.kommo_lead_id) as lead_count
      FROM kommo_pipeline_stages ps
      LEFT JOIN kommo_leads_cache lc ON lc.status_id = ps.status_id
      GROUP BY ps.id, ps.stage_name, ps.stage_color, ps.pipeline_id, ps.status_id, ps.stage_order
      HAVING COUNT(lc.kommo_lead_id) > 0
      ORDER BY ps.stage_order, ps.stage_name
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Categorias de etapas Kommo — ordem importa (mais especifico primeiro)
const KOMMO_CATEGORIES = [
  { name: 'DESQUALIFICADOS', color: '#ff8f92', patterns: ['desqualificad', 'desclassificad', 'detrator', 'reembolso', 'perdida'] },
  { name: 'SUPORTE', color: '#eb93ff', patterns: ['suporte', 'pos venda', 'pós venda', 'retenção', 'retençâo', 'retencao', 'entregáve', 'entregave'] },
  { name: 'EM PROCESSO DE VENDAS', color: '#87f2c0', patterns: ['processo de venda', 'rmkt', 'remarketing', 'ofereci black', 'ofereceu black', 'negociac', 'oferta feita', 'aquecendo', 'fup ', 'interesse', 'quer black', 'esperando resposta', 'planilha antig', 'comunidade', 'já chamou'] },
  { name: 'VENDAS', color: '#00b894', patterns: ['vendas', 'vendeu black', 'venda de black', 'black code', 'aluno black', 'venda - ok', 'convertido', 'venda ganha', 'garimpo'] },
  { name: 'INICIANTE', color: '#ffdc7f', patterns: ['iniciante', 'ftd', 'primeiro dep', 'cadastrou', 'cadastro', '1\u00b0 acesso', 'fez ftd', 'jogador'] },
  { name: 'LEAD DE ENTRADA', color: '#c1c1c1', patterns: ['leads de entrada', 'etapa de leads', 'contato inicial', 'lead aquecido', 'chamei hoje', 'qualifica', 'primeiro contato', 'promotor'] },
];

function classifyStage(stageName) {
  const lower = stageName.toLowerCase();
  for (const cat of KOMMO_CATEGORIES) {
    if (cat.patterns.some(p => lower.includes(p))) return cat.name;
  }
  return null;
}

// Gera WHERE clause para filtro de data/turno sobre lead_updated_at
function kommoDateFilter(date, shift) {
  if (!date) return { where: '', params: [], offset: 0 };
  const params = [];
  let where = '';
  // Turnos: manha = 09:00-14:00, completo = 09:00-18:00, vazio = dia todo
  if (shift === 'manha') {
    params.push(`${date} 09:00:00`, `${date} 14:00:00`);
    where = ` AND lc.lead_updated_at >= $P1 AND lc.lead_updated_at < $P2`;
  } else if (shift === 'completo') {
    params.push(`${date} 09:00:00`, `${date} 18:00:00`);
    where = ` AND lc.lead_updated_at >= $P1 AND lc.lead_updated_at < $P2`;
  } else {
    params.push(`${date} 00:00:00`, `${date} 23:59:59`);
    where = ` AND lc.lead_updated_at >= $P1 AND lc.lead_updated_at <= $P2`;
  }
  return { where, params };
}

// Contagem de leads agrupada por categorias fixas (dashboard cards)
app.get('/api/kommo/leads-summary', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { date, shift } = req.query;
    const filter = kommoDateFilter(date, shift);

    // Montar query com placeholders reais
    let paramIdx = 1;
    const qParams = [];
    let whereClause = '';
    if (filter.params.length) {
      whereClause = ` WHERE (lc.lead_created_at >= $${paramIdx} AND lc.lead_created_at < $${paramIdx + 1})
                      OR (lc.lead_updated_at >= $${paramIdx} AND lc.lead_updated_at < $${paramIdx + 1})`;
      if (!date || (!shift && date)) {
        whereClause = ` WHERE (lc.lead_created_at >= $${paramIdx} AND lc.lead_created_at <= $${paramIdx + 1})
                        OR (lc.lead_updated_at >= $${paramIdx} AND lc.lead_updated_at <= $${paramIdx + 1})`;
      }
      qParams.push(...filter.params);
      paramIdx += filter.params.length;
    }

    const result = await pool.query(`
      SELECT ps.stage_name, COUNT(lc.kommo_lead_id) as lead_count
      FROM kommo_leads_cache lc
      JOIN kommo_pipeline_stages ps ON ps.status_id = lc.status_id
      ${whereClause}
      GROUP BY ps.stage_name
    `, qParams);

    const summary = KOMMO_CATEGORIES.map(cat => ({ ...cat, lead_count: 0 }));
    let unclassified = 0;

    for (const row of result.rows) {
      const catName = classifyStage(row.stage_name);
      if (catName) {
        summary.find(c => c.name === catName).lead_count += parseInt(row.lead_count);
      } else {
        unclassified += parseInt(row.lead_count);
      }
    }

    const totalQ = await pool.query(`SELECT COUNT(*) as total FROM kommo_leads_cache${whereClause ? ' lc' + whereClause : ''}`, qParams);

    res.json({
      stages: summary.map(({ patterns, ...rest }) => rest),
      total: parseInt(totalQ.rows[0].total),
      unclassified,
      filtered: !!date,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leads por vendedora agrupados por categoria
app.get('/api/kommo/leads-by-seller', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { date, shift } = req.query;
    const qParams = [];
    let whereClause = '';

    if (date) {
      if (shift === 'manha') {
        qParams.push(`${date} 09:00:00`, `${date} 14:00:00`);
      } else if (shift === 'completo') {
        qParams.push(`${date} 09:00:00`, `${date} 18:00:00`);
      } else {
        qParams.push(`${date} 00:00:00`, `${date} 23:59:59`);
      }
      whereClause = ` WHERE (lc.lead_created_at >= $1 AND lc.lead_created_at ${shift ? '<' : '<='} $2)
                      OR (lc.lead_updated_at >= $1 AND lc.lead_updated_at ${shift ? '<' : '<='} $2)`;
    }

    const result = await pool.query(`
      SELECT ps.stage_name, COALESCE(um.kommo_user_name, 'Não atribuído') as seller_name,
             um.kommo_user_id, COUNT(lc.kommo_lead_id) as lead_count
      FROM kommo_leads_cache lc
      JOIN kommo_pipeline_stages ps ON ps.status_id = lc.status_id
      LEFT JOIN kommo_user_map um ON um.kommo_user_id = lc.kommo_user_id
      ${whereClause}
      GROUP BY ps.stage_name, um.kommo_user_name, um.kommo_user_id
    `, qParams);

    const sellers = {};
    for (const row of result.rows) {
      const sName = row.seller_name;
      if (!sellers[sName]) {
        sellers[sName] = { name: sName, kommo_user_id: row.kommo_user_id, total: 0 };
        KOMMO_CATEGORIES.forEach(c => { sellers[sName][c.name] = 0; });
      }
      const catName = classifyStage(row.stage_name);
      const count = parseInt(row.lead_count);
      if (catName) sellers[sName][catName] += count;
      sellers[sName].total += count;
    }

    const rows = Object.values(sellers).sort((a, b) => b.total - a.total);
    res.json({ categories: KOMMO_CATEGORIES.map(c => c.name), sellers: rows, filtered: !!date });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Relatorio diario completo de um vendedor (replica o formato manual)
// Criterio de "respondeu": lead saiu da stage de entrada (movimentacao efetiva no pipeline)
// Criterio de "nao respondeu": lead ainda esta na stage de entrada (nenhuma acao do vendedor)
app.get('/api/kommo/seller-daily-report', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { seller_kommo_id, date, start_hour = 0, end_hour = 24 } = req.query;
    if (!seller_kommo_id || !date) {
      return res.status(400).json({ error: 'seller_kommo_id e date sao obrigatorios' });
    }
    const kommoUserId = parseInt(seller_kommo_id);
    const startBrt = `${date} ${String(start_hour).padStart(2,'0')}:00:00`;
    const endBrt = `${date} ${String(end_hour).padStart(2,'0')}:00:00`;
    const toUtc = (brt) => new Date(brt + '-03:00').toISOString().replace('T',' ').substring(0,19);
    const startUtc = toUtc(startBrt);
    const endUtc = toUtc(endBrt);

    const umRes = await pool.query('SELECT kommo_user_name, source_names FROM kommo_user_map WHERE kommo_user_id = $1', [kommoUserId]);
    if (!umRes.rows.length) return res.status(404).json({ error: 'Vendedor nao encontrado' });
    const { kommo_user_name, source_names } = umRes.rows[0];
    const sources = source_names && source_names.length ? source_names : [];
    if (!sources.length) return res.status(400).json({ error: 'Vendedor nao tem source_names configurados' });

    // 1) IDs dos leads novos (unsorted_add por source mapeada)
    const idsRes = await pool.query(
      `SELECT DISTINCT kommo_lead_id
       FROM kommo_unsorted_leads
       WHERE source_name = ANY($1) AND event_action = 'add'
         AND created_at >= $2 AND created_at < $3
         AND kommo_lead_id IS NOT NULL`,
      [sources, startUtc, endUtc]
    );
    const novosIds = idsRes.rows.map(r => r.kommo_lead_id);
    const totalNovos = novosIds.length;

    if (!totalNovos) {
      return res.json({
        seller: { kommo_user_id: kommoUserId, name: kommo_user_name, source_names: sources },
        periodo: { date, start_hour: Number(start_hour), end_hour: Number(end_hour) },
        metricas: { total_novos: 0, respondeu: 0, nao_respondeu: 0, por_stage: {}, vendas: 0, em_processo: 0 },
        lead_ids: []
      });
    }

    // 2) Pipeline principal + stage de entrada (infere pelo pipeline dominante dos leads)
    const pipeRes = await pool.query(
      `SELECT pipeline_id, COUNT(*) AS c FROM kommo_leads_cache WHERE kommo_lead_id = ANY($1) GROUP BY pipeline_id ORDER BY c DESC LIMIT 1`,
      [novosIds]
    );
    const mainPipeline = pipeRes.rows[0]?.pipeline_id;
    const entryStageRes = mainPipeline ? await pool.query(
      `SELECT status_id FROM kommo_pipeline_stages WHERE pipeline_id = $1 ORDER BY stage_order ASC LIMIT 1`,
      [mainPipeline]
    ) : { rows: [] };
    const entryStatusId = entryStageRes.rows[0]?.status_id || null;

    // 3) Respondeu: lead saiu da stage de entrada OU teve transicao de status no periodo
    const respRes = await pool.query(
      `SELECT COUNT(DISTINCT kommo_lead_id) AS total
       FROM kommo_leads_cache
       WHERE kommo_lead_id = ANY($1)
         AND (status_id != $2 OR $2 IS NULL)
         AND pipeline_id = $3`,
      [novosIds, entryStatusId, mainPipeline]
    );
    const respondeu = parseInt(respRes.rows[0].total);

    // 4) Distribuicao por stage atual (cache)
    const stageRes = await pool.query(
      `SELECT ps.stage_name, ps.stage_order, COUNT(DISTINCT lc.kommo_lead_id) AS qtde
       FROM kommo_leads_cache lc
       LEFT JOIN kommo_pipeline_stages ps ON ps.status_id = lc.status_id
       WHERE lc.kommo_lead_id = ANY($1)
       GROUP BY ps.stage_name, ps.stage_order
       ORDER BY ps.stage_order NULLS LAST`,
      [novosIds]
    );
    const porStage = {};
    for (const r of stageRes.rows) porStage[r.stage_name || '[outro pipeline]'] = parseInt(r.qtde);

    // 5) Contadores de negocio (a partir do stage atual)
    const vendas = porStage['VENDAS'] || 0;
    const emProcesso = porStage['em processo de VENDAS'] || 0;
    const iniciantes = porStage['INICIANTE'] || 0;
    const desqualificados = porStage['DESQUALIFICADOS'] || 0;

    res.json({
      seller: { kommo_user_id: kommoUserId, name: kommo_user_name, source_names: sources },
      periodo: { date, start_hour: Number(start_hour), end_hour: Number(end_hour), start_utc: startUtc, end_utc: endUtc },
      pipeline: { id: mainPipeline, entry_status_id: entryStatusId },
      metricas: {
        total_novos: totalNovos,
        respondeu: respondeu,
        nao_respondeu: Math.max(0, totalNovos - respondeu),
        iniciantes,
        desqualificados,
        em_processo_vendas: emProcesso,
        vendas,
        por_stage: porStage
      },
      lead_ids: novosIds
    });
  } catch (err) {
    console.error('[seller-daily-report]', err);
    res.status(500).json({ error: err.message });
  }
});

// Listar users do Kommo
app.get('/api/kommo/users', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const data = await kommoRequest('GET', '/users');
    const users = (data?._embedded?.users || []).map(u => ({ id: u.id, name: u.name, email: u.email }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar mapeamento de users
app.get('/api/kommo/user-map', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, s.user_id as seller_user_id, u.name as seller_name
      FROM kommo_user_map m
      LEFT JOIN sellers s ON m.seller_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY m.kommo_user_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar mapeamento' });
  }
});

// Salvar mapeamento de um user Kommo → vendedora
app.patch('/api/kommo/user-map/:kommoUserId', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { seller_id } = req.body;
    const kommoUserId = parseInt(req.params.kommoUserId);
    await pool.query(
      `INSERT INTO kommo_user_map (kommo_user_id, seller_id) VALUES ($1, $2)
       ON CONFLICT (kommo_user_id) DO UPDATE SET seller_id=$2`,
      [kommoUserId, seller_id || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar mapeamento' });
  }
});

// Auto-mapear users Kommo por email
app.post('/api/kommo/auto-map', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const kommoUsers = await kommoRequest('GET', '/users');
    const users = kommoUsers?._embedded?.users || [];
    let mapped = 0;

    for (const ku of users) {
      // Salvar/atualizar user na tabela de mapeamento
      await pool.query(
        `INSERT INTO kommo_user_map (kommo_user_id, kommo_user_name, kommo_user_email)
         VALUES ($1, $2, $3)
         ON CONFLICT (kommo_user_id) DO UPDATE SET kommo_user_name=$2, kommo_user_email=$3`,
        [ku.id, ku.name, ku.email]
      );

      // Tentar mapear por email
      if (ku.email) {
        const seller = await pool.query(
          `SELECT s.id FROM sellers s JOIN users u ON s.user_id = u.id WHERE LOWER(u.email) = LOWER($1) AND s.active = true`,
          [ku.email]
        );
        if (seller.rows.length) {
          await pool.query(
            `UPDATE kommo_user_map SET seller_id=$1, auto_mapped=true WHERE kommo_user_id=$2`,
            [seller.rows[0].id, ku.id]
          );
          mapped++;
        }
      }
    }

    res.json({ total: users.length, mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync manual: puxar leads do Kommo e calcular métricas
app.post('/api/kommo/sync', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { date } = req.body;
    const syncDate = date || new Date().toISOString().split('T')[0];

    // Criar log de sync
    const logResult = await pool.query(
      `INSERT INTO kommo_sync_log (sync_type, status) VALUES ('manual', 'running') RETURNING id`
    );
    const syncId = logResult.rows[0].id;

    const config = await pool.query('SELECT * FROM kommo_config LIMIT 1');
    if (!config.rows.length || !config.rows[0].connected) {
      await pool.query(`UPDATE kommo_sync_log SET status='error', error_message='Kommo não conectado', finished_at=NOW() WHERE id=$1`, [syncId]);
      return res.status(400).json({ error: 'Kommo não conectado' });
    }
    const cfg = config.rows[0];

    if (!cfg.pipeline_id || !cfg.stage_won) {
      await pool.query(`UPDATE kommo_sync_log SET status='error', error_message='Pipeline/stages não configurados', finished_at=NOW() WHERE id=$1`, [syncId]);
      return res.status(400).json({ error: 'Pipeline e stages não configurados' });
    }

    // Buscar mapeamento de users
    const userMap = await pool.query('SELECT * FROM kommo_user_map WHERE seller_id IS NOT NULL');
    const map = {};
    for (const um of userMap.rows) map[um.kommo_user_id] = um.seller_id;

    if (Object.keys(map).length === 0) {
      await pool.query(`UPDATE kommo_sync_log SET status='error', error_message='Nenhum user mapeado', finished_at=NOW() WHERE id=$1`, [syncId]);
      return res.status(400).json({ error: 'Nenhum user Kommo mapeado para vendedoras' });
    }

    // Calcular timestamps do dia
    const dayStart = new Date(syncDate + 'T00:00:00').getTime() / 1000;
    const dayEnd = new Date(syncDate + 'T23:59:59').getTime() / 1000;

    // Buscar leads do pipeline, criados ou atualizados no dia
    let allLeads = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await kommoRequest('GET',
        `/leads?filter[pipeline_id]=${cfg.pipeline_id}&filter[updated_at][from]=${dayStart}&filter[updated_at][to]=${dayEnd}&limit=250&page=${page}`
      );
      const leads = data?._embedded?.leads || [];
      allLeads = allLeads.concat(leads);
      hasMore = leads.length === 250;
      page++;
      // Rate limit: esperar um pouco entre pages
      if (hasMore) await new Promise(r => setTimeout(r, 200));
    }

    // Cache dos leads
    for (const lead of allLeads) {
      const revenue = lead.price || 0;
      await pool.query(
        `INSERT INTO kommo_leads_cache (kommo_lead_id, kommo_user_id, pipeline_id, status_id, revenue, lead_created_at, lead_updated_at, synced_at)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), NOW())
         ON CONFLICT (kommo_lead_id) DO UPDATE SET kommo_user_id=$2, status_id=$4, revenue=$5, lead_updated_at=to_timestamp($7), synced_at=NOW()`,
        [lead.id, lead.responsible_user_id, lead.pipeline_id, lead.status_id, revenue, lead.created_at, lead.updated_at]
      );
    }

    // Calcular métricas por vendedora
    const metrics = {};
    for (const lead of allLeads) {
      const sellerId = map[lead.responsible_user_id];
      if (!sellerId) continue;

      if (!metrics[sellerId]) metrics[sellerId] = { leads_received: 0, leads_responded: 0, conversions: 0, sales_closed: 0, revenue: 0 };
      const m = metrics[sellerId];

      // Lead recebido: qualquer lead no pipeline
      m.leads_received++;

      // Respondido: saiu do stage inicial
      if (lead.status_id !== cfg.stage_new_lead) m.leads_responded++;

      // Conversão: chegou no stage de interesse
      if (cfg.stage_interested && lead.status_id === cfg.stage_interested) m.conversions++;

      // Também conta como conversão se já passou para won
      if (lead.status_id === cfg.stage_won) {
        m.conversions++;
        m.sales_closed++;
        m.revenue += parseFloat(lead.price || 0);
      }
    }

    // Salvar como relatórios do tipo 'completo' para o dia
    let reportsCreated = 0;
    for (const [sellerId, m] of Object.entries(metrics)) {
      await pool.query(
        `INSERT INTO sales_reports (seller_id, report_date, report_type, leads_received, leads_responded, conversions, sales_closed, revenue, notes)
         VALUES ($1, $2, 'completo', $3, $4, $5, $6, $7, 'Sync automático Kommo')
         ON CONFLICT (seller_id, report_date, report_type)
         DO UPDATE SET leads_received=$3, leads_responded=$4, conversions=$5, sales_closed=$6, revenue=$7, notes='Sync automático Kommo', updated_at=NOW()`,
        [parseInt(sellerId), syncDate, m.leads_received, m.leads_responded, m.conversions, m.sales_closed, m.revenue]
      );
      reportsCreated++;
    }

    // Atualizar log e config
    await pool.query(`UPDATE kommo_sync_log SET status='success', leads_processed=$1, reports_created=$2, finished_at=NOW() WHERE id=$3`, [allLeads.length, reportsCreated, syncId]);
    await pool.query(`UPDATE kommo_config SET last_sync_at=NOW()`);

    res.json({ leads_processed: allLeads.length, reports_created: reportsCreated, date: syncDate });
  } catch (err) {
    console.error('Kommo sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Listar logs de sync
app.get('/api/kommo/sync-logs', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kommo_sync_log ORDER BY started_at DESC LIMIT 20');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar logs' });
  }
});

// Webhook endpoint (Kommo envia updates aqui)
// URL: https://demandas.sortehub.online/api/kommo/webhook
app.post('/api/kommo/webhook', async (req, res) => {
  res.sendStatus(200);

  let eventId = null;
  try {
    const body = req.body;
    console.log('[Kommo Webhook] Body:', JSON.stringify(body).substring(0, 500));

    const eventType = body?.leads?.add ? 'lead_add'
      : body?.leads?.status ? 'lead_status'
      : body?.leads?.update ? 'lead_update'
      : body?.leads?.responsible ? 'lead_responsible'
      : body?.contacts?.add ? 'contact_add'
      : body?.contacts?.update ? 'contact_update'
      : body?.unsorted?.add ? 'unsorted_add'
      : body?.unsorted?.update ? 'unsorted_update'
      : body?.unsorted?.delete ? 'unsorted_accept'
      : body?.talk?.update ? 'talk_update'
      : body?.talk?.add ? 'talk_add'
      : body?.message?.add ? 'message_add'
      : body?.message?.update ? 'message_update'
      : 'unknown';

    // Salvar evento bruto
    const evRes = await pool.query(
      `INSERT INTO kommo_webhook_events (event_type, payload, processed) VALUES ($1, $2, false) RETURNING id`,
      [eventType, JSON.stringify(body)]
    );
    eventId = evRes.rows[0].id;

    // Mapeamento de users Kommo → sellers
    const userMapRes = await pool.query('SELECT kommo_user_id, seller_id FROM kommo_user_map WHERE seller_id IS NOT NULL');
    const sellerMap = {};
    for (const um of userMapRes.rows) sellerMap[um.kommo_user_id] = um.seller_id;

    const today = new Date().toISOString().split('T')[0];

    // ─── Processar LEADS (add, update, status, responsible) ───
    const leads = body?.leads?.add || body?.leads?.update || body?.leads?.status || body?.leads?.responsible || [];
    const affectedSellers = new Set();

    if (leads.length) {
      const configRes = await pool.query('SELECT * FROM kommo_config LIMIT 1');
      const cfg = configRes.rows[0] || null;

      for (const lead of leads) {
        const leadId = parseInt(lead.id);
        const statusId = parseInt(lead.status_id);
        const rawResponsible = parseInt(lead.responsible_user_id) || 0;
        const modifiedBy = parseInt(lead.modified_user_id) || 0;
        // Só considera fallback se o kommo_user estiver mapeado a um seller real
        // (evita atribuir leads ao admin/sistema que dispara modified_user_id em massa)
        let responsibleId = 0;
        if (sellerMap[rawResponsible]) responsibleId = rawResponsible;
        else if (sellerMap[modifiedBy]) responsibleId = modifiedBy;
        // Caso contrário mantém 0 — ON CONFLICT preserva kommo_user_id anterior
        const price = parseFloat(lead.price || 0);
        const pipelineId = parseInt(lead.pipeline_id || cfg?.pipeline_id || 0);

        await pool.query(
          `INSERT INTO kommo_leads_cache (kommo_lead_id, kommo_user_id, pipeline_id, status_id, revenue, lead_created_at, lead_updated_at, synced_at)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), NOW())
           ON CONFLICT (kommo_lead_id) DO UPDATE SET kommo_user_id=CASE WHEN $2 != 0 THEN $2 ELSE kommo_leads_cache.kommo_user_id END, pipeline_id=$3, status_id=$4, revenue=$5, lead_updated_at=to_timestamp($7), synced_at=NOW()`,
          [leadId, responsibleId, pipelineId, statusId, price, lead.created_at || 0, lead.updated_at || 0]
        );
        const sid = sellerMap[responsibleId];
        if (sid) affectedSellers.add(sid);
      }

      // Recalcular métricas de vendas do dia
      if (affectedSellers.size > 0 && cfg?.pipeline_id) {
        for (const sellerId of affectedSellers) {
          const kumRes = await pool.query('SELECT kommo_user_id FROM kommo_user_map WHERE seller_id = $1', [sellerId]);
          const kommoUserIds = kumRes.rows.map(r => r.kommo_user_id);
          if (!kommoUserIds.length) continue;

          const metricsRes = await pool.query(
            `SELECT
              COUNT(*) AS leads_received,
              COUNT(*) FILTER (WHERE status_id != $1) AS leads_responded,
              COUNT(*) FILTER (WHERE status_id = $2 OR status_id = $3) AS conversions,
              COUNT(*) FILTER (WHERE status_id = $3) AS sales_closed,
              COALESCE(SUM(revenue) FILTER (WHERE status_id = $3), 0) AS revenue
             FROM kommo_leads_cache
             WHERE kommo_user_id = ANY($4) AND pipeline_id = $5
               AND ((lead_created_at >= $6::date AND lead_created_at < ($6::date + interval '1 day'))
                OR (lead_updated_at >= $6::date AND lead_updated_at < ($6::date + interval '1 day')))`,
            [cfg.stage_new_lead || 0, cfg.stage_interested || 0, cfg.stage_won || 0, kommoUserIds, cfg.pipeline_id, today]
          );
          const m = metricsRes.rows[0];
          await pool.query(
            `INSERT INTO sales_reports (seller_id, report_date, report_type, leads_received, leads_responded, conversions, sales_closed, revenue, notes)
             VALUES ($1, $2, 'completo', $3, $4, $5, $6, $7, 'Webhook Kommo (tempo real)')
             ON CONFLICT (seller_id, report_date, report_type)
             DO UPDATE SET leads_received=$3, leads_responded=$4, conversions=$5, sales_closed=$6, revenue=$7, notes='Webhook Kommo (tempo real)', updated_at=NOW()`,
            [sellerId, today, parseInt(m.leads_received), parseInt(m.leads_responded), parseInt(m.conversions), parseInt(m.sales_closed), parseFloat(m.revenue)]
          );
        }
        await pool.query(`UPDATE kommo_config SET last_sync_at=NOW()`);
      }
      console.log(`[Webhook] ${leads.length} leads processados (${eventType})`);
    }

    // ─── Processar UNSORTED (leads vindos do WhatsApp/chat) ───
    const unsortedItems = body?.unsorted?.add || body?.unsorted?.update || body?.unsorted?.delete || [];
    if (unsortedItems.length) {
      const action = body?.unsorted?.add ? 'add' : body?.unsorted?.update ? 'update' : 'accept';
      for (const item of unsortedItems) {
        const leadData = item.data?.leads?.[0];
        const contactData = item.data?.contacts?.[0];
        const phone = contactData?.custom_fields
          ? Object.values(contactData.custom_fields).find(f => f.code === 'PHONE')?.values
            ? Object.values(Object.values(contactData.custom_fields).find(f => f.code === 'PHONE')?.values || {})[0]?.value
            : null
          : null;
        const sourceData = item.source_data || {};
        const initialMsg = sourceData.data?.length
          ? sourceData.data.map(d => d.text).filter(Boolean).join('\n')
          : null;

        // Tentar identificar vendedor pelo lead no cache ou pelo modified_user_id
        let sellerKommoId = null;
        if (leadData?.id) {
          const cached = await pool.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [parseInt(leadData.id)]);
          if (cached.rows[0]?.kommo_user_id) sellerKommoId = cached.rows[0].kommo_user_id;
        }

        await pool.query(
          `INSERT INTO kommo_unsorted_leads (uid, kommo_lead_id, lead_name, contact_id, contact_name, contact_phone, source, source_name, category, pipeline_id, initial_message, seller_kommo_id, event_action, webhook_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            item.uid || null,
            leadData?.id ? parseInt(leadData.id) : (item.lead_id ? parseInt(item.lead_id) : null),
            leadData?.name || null,
            contactData?.id ? parseInt(contactData.id) : null,
            contactData?.name || null,
            phone,
            sourceData.service || sourceData.site || null,
            sourceData.source_name || sourceData.from || null,
            item.category || null,
            leadData?.pipeline_id ? parseInt(leadData.pipeline_id) : (item.pipeline_id ? parseInt(item.pipeline_id) : null),
            initialMsg,
            sellerKommoId,
            action,
            eventId
          ]
        );
      }
      console.log(`[Webhook] ${unsortedItems.length} unsorted processados (${action})`);
    }

    // ─── Processar TALK (conversas) ───
    const talkItems = body?.talk?.add || body?.talk?.update || [];
    if (talkItems.length) {
      for (const t of talkItems) {
        const talkId = t.talk_id ? parseInt(t.talk_id) : null;
        if (!talkId) continue;

        // Buscar vendedor responsável pelo lead associado
        let sellerKommoId = null;
        const leadId = t.entity_id ? parseInt(t.entity_id) : null;
        if (leadId) {
          const cached = await pool.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [leadId]);
          if (cached.rows[0]?.kommo_user_id && cached.rows[0].kommo_user_id !== 0) {
            sellerKommoId = cached.rows[0].kommo_user_id;
          }
        }

        await pool.query(
          `INSERT INTO kommo_conversations (talk_id, chat_id, lead_id, contact_id, origin, is_read, is_in_work, rate, seller_kommo_id, webhook_event_id, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT (talk_id) DO UPDATE SET
             is_read=$6, is_in_work=$7, rate=$8, seller_kommo_id=COALESCE(NULLIF($9, 0), kommo_conversations.seller_kommo_id), updated_at=NOW()`,
          [
            talkId,
            t.chat_id || null,
            leadId,
            t.contact_id ? parseInt(t.contact_id) : null,
            t.origin || null,
            t.is_read === '1' || t.is_read === true,
            t.is_in_work === '1' || t.is_in_work === true,
            parseInt(t.rate || 0),
            sellerKommoId,
            eventId
          ]
        );
      }
      console.log(`[Webhook] ${talkItems.length} talks processados`);
    }

    // ─── Processar MESSAGE (mensagens individuais) ───
    const messageItems = body?.message?.add || body?.message?.update || [];
    if (messageItems.length) {
      for (const msg of messageItems) {
        const msgId = msg.id || null;
        // Evitar duplicatas
        if (msgId) {
          const exists = await pool.query('SELECT 1 FROM kommo_messages WHERE message_id = $1', [msgId]);
          if (exists.rows.length) continue;
        }

        // Identificar vendedor: pelo lead associado ou pela conversa
        let sellerKommoId = null;
        const leadId = msg.entity_id ? parseInt(msg.entity_id) : (msg.element_id ? parseInt(msg.element_id) : null);
        if (leadId) {
          const cached = await pool.query('SELECT kommo_user_id FROM kommo_leads_cache WHERE kommo_lead_id = $1', [leadId]);
          if (cached.rows[0]?.kommo_user_id && cached.rows[0].kommo_user_id !== 0) {
            sellerKommoId = cached.rows[0].kommo_user_id;
          }
        }
        // Fallback: buscar pela conversa (talk_id)
        if (!sellerKommoId && msg.talk_id) {
          const conv = await pool.query('SELECT seller_kommo_id FROM kommo_conversations WHERE talk_id = $1', [parseInt(msg.talk_id)]);
          if (conv.rows[0]?.seller_kommo_id) sellerKommoId = conv.rows[0].seller_kommo_id;
        }

        await pool.query(
          `INSERT INTO kommo_messages (message_id, talk_id, chat_id, lead_id, contact_id, author_name, author_type, text, msg_type, origin, seller_kommo_id, message_at, webhook_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            msgId,
            msg.talk_id ? parseInt(msg.talk_id) : null,
            msg.chat_id || null,
            leadId,
            msg.contact_id ? parseInt(msg.contact_id) : null,
            msg.author?.name || null,
            msg.author?.type || msg.type || null,
            msg.text || null,
            msg.type || null,
            msg.origin || null,
            sellerKommoId,
            msg.created_at ? new Date(parseInt(msg.created_at) * 1000) : new Date(),
            eventId
          ]
        );
      }
      console.log(`[Webhook] ${messageItems.length} mensagens processadas`);
    }

    // Marcar evento como processado
    await pool.query(
      `UPDATE kommo_webhook_events SET processed=true, processed_at=NOW() WHERE id = $1`,
      [eventId]
    );
  } catch (err) {
    console.error('[Kommo Webhook Error]', err);
    // Salvar erro no último evento
    if (eventId) {
      await pool.query(
        `UPDATE kommo_webhook_events SET error_message=$1 WHERE id = $2`,
        [err.message, eventId]
      ).catch(() => {});
    }
  }
});

// Métricas do webhook (para Sara acompanhar saúde da integração)
app.get('/api/kommo/webhook-stats', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total_events,
        COUNT(*) FILTER (WHERE processed = true) AS processed,
        COUNT(*) FILTER (WHERE processed = false) AS pending,
        COUNT(*) FILTER (WHERE created_at > NOW() - interval '1 hour') AS last_hour,
        COUNT(*) FILTER (WHERE created_at > NOW() - interval '24 hours') AS last_24h,
        MAX(created_at) AS last_event_at
      FROM kommo_webhook_events
    `);

    const byType = await pool.query(`
      SELECT event_type, COUNT(*) AS count,
        MAX(created_at) AS last_at
      FROM kommo_webhook_events
      WHERE created_at > NOW() - interval '24 hours'
      GROUP BY event_type
      ORDER BY count DESC
    `);

    const recentErrors = await pool.query(`
      SELECT id, event_type, error_message, created_at
      FROM kommo_webhook_events
      WHERE error_message IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      by_type: byType.rows,
      recent_errors: recentErrors.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar últimos eventos do webhook
app.get('/api/kommo/webhook-events', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT id, event_type, processed, processed_at, error_message, created_at
       FROM kommo_webhook_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Métricas completas de webhook ───

// Métricas gerais (unsorted, mensagens, conversas)
app.get('/api/kommo/metrics', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const { period } = req.query; // today, 7d, 30d
    const dateFilter = period === '30d' ? "NOW() - interval '30 days'"
      : period === '7d' ? "NOW() - interval '7 days'"
      : 'CURRENT_DATE';

    // Unsorted leads por fonte
    const unsortedBySource = await pool.query(`
      SELECT source, source_name, COUNT(*) as count,
        COUNT(DISTINCT contact_name) as unique_contacts
      FROM kommo_unsorted_leads WHERE created_at >= ${dateFilter}
      GROUP BY source, source_name ORDER BY count DESC
    `);

    // Unsorted leads por dia
    const unsortedByDay = await pool.query(`
      SELECT created_at::date as day, COUNT(*) as count
      FROM kommo_unsorted_leads WHERE created_at >= ${dateFilter}
      GROUP BY day ORDER BY day
    `);

    // Mensagens por tipo (incoming/outgoing)
    const messagesByType = await pool.query(`
      SELECT msg_type, COUNT(*) as count
      FROM kommo_messages WHERE created_at >= ${dateFilter}
      GROUP BY msg_type
    `);

    // Mensagens por dia e tipo
    const messagesByDay = await pool.query(`
      SELECT created_at::date as day, msg_type, COUNT(*) as count
      FROM kommo_messages WHERE created_at >= ${dateFilter}
      GROUP BY day, msg_type ORDER BY day
    `);

    // Mensagens por autor (vendedoras)
    const messagesByAuthor = await pool.query(`
      SELECT
        COALESCE(kum.kommo_user_name, m.author_name, 'Desconhecido') as name,
        m.author_type,
        COUNT(*) as count
      FROM kommo_messages m
      LEFT JOIN kommo_user_map kum ON m.seller_kommo_id = kum.kommo_user_id
      WHERE m.created_at >= ${dateFilter}
      GROUP BY name, m.author_type ORDER BY count DESC
    `);

    // Conversas ativas
    const conversations = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_in_work = true) as in_work,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE is_read = true) as read,
        AVG(EXTRACT(EPOCH FROM (updated_at - first_seen_at))/60)::int as avg_duration_min
      FROM kommo_conversations WHERE updated_at >= ${dateFilter}
    `);

    // Volume por hora (últimas 24h)
    const hourlyVolume = await pool.query(`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) FILTER (WHERE msg_type = 'incoming') as incoming,
        COUNT(*) FILTER (WHERE msg_type != 'incoming') as outgoing
      FROM kommo_messages WHERE created_at >= NOW() - interval '24 hours'
      GROUP BY hour ORDER BY hour
    `);

    // Métricas por vendedora
    const sellerMetrics = await pool.query(`
      SELECT
        COALESCE(kum.kommo_user_name, 'Sem mapeamento') as seller_name,
        kum.seller_id,
        COUNT(*) FILTER (WHERE m.msg_type = 'incoming') as msgs_incoming,
        COUNT(*) FILTER (WHERE m.msg_type != 'incoming') as msgs_outgoing,
        COUNT(DISTINCT m.talk_id) as conversations,
        COUNT(DISTINCT m.contact_id) as unique_contacts
      FROM kommo_messages m
      LEFT JOIN kommo_user_map kum ON m.seller_kommo_id = kum.kommo_user_id
      WHERE m.created_at >= ${dateFilter}
      GROUP BY kum.kommo_user_name, kum.seller_id
      ORDER BY msgs_incoming DESC
    `);

    // Totais rápidos
    const totals = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM kommo_unsorted_leads WHERE created_at >= ${dateFilter}) as total_unsorted,
        (SELECT COUNT(*) FROM kommo_messages WHERE created_at >= ${dateFilter}) as total_messages,
        (SELECT COUNT(*) FROM kommo_messages WHERE msg_type = 'incoming' AND created_at >= ${dateFilter}) as total_incoming,
        (SELECT COUNT(*) FROM kommo_messages WHERE msg_type != 'incoming' AND created_at >= ${dateFilter}) as total_outgoing,
        (SELECT COUNT(*) FROM kommo_conversations WHERE updated_at >= ${dateFilter}) as total_conversations,
        (SELECT COUNT(DISTINCT contact_name) FROM kommo_unsorted_leads WHERE created_at >= ${dateFilter}) as unique_leads
    `);

    res.json({
      totals: totals.rows[0],
      unsorted_by_source: unsortedBySource.rows,
      unsorted_by_day: unsortedByDay.rows,
      messages_by_type: messagesByType.rows,
      messages_by_day: messagesByDay.rows,
      messages_by_author: messagesByAuthor.rows,
      conversations: conversations.rows[0],
      hourly_volume: hourlyVolume.rows,
      seller_metrics: sellerMetrics.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Últimos leads unsorted (feed em tempo real)
app.get('/api/kommo/unsorted-leads', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT * FROM kommo_unsorted_leads ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Últimas mensagens
app.get('/api/kommo/messages', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { talk_id } = req.query;
    let query = 'SELECT * FROM kommo_messages';
    const params = [];
    if (talk_id) { query += ' WHERE talk_id = $1'; params.push(talk_id); }
    query += ' ORDER BY message_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Conversas ativas
app.get('/api/kommo/conversations', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, kum.kommo_user_name as seller_name
      FROM kommo_conversations c
      LEFT JOIN kommo_user_map kum ON c.seller_kommo_id = kum.kommo_user_id
      ORDER BY c.updated_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reprocessar eventos antigos (admin only - para corrigir "unknown" históricos)
app.post('/api/kommo/reprocess', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const unknowns = await pool.query(
      "SELECT id, payload FROM kommo_webhook_events WHERE event_type = 'unknown' AND processed = false ORDER BY id"
    );
    let fixed = 0;
    for (const row of unknowns.rows) {
      const body = row.payload;
      let newType = 'unknown';
      if (body?.unsorted?.add) newType = 'unsorted_add';
      else if (body?.unsorted?.update) newType = 'unsorted_update';
      else if (body?.unsorted?.delete) newType = 'unsorted_accept';
      else if (body?.talk?.update) newType = 'talk_update';
      else if (body?.talk?.add) newType = 'talk_add';
      else if (body?.message?.add) newType = 'message_add';
      if (newType !== 'unknown') {
        await pool.query('UPDATE kommo_webhook_events SET event_type = $1 WHERE id = $2', [newType, row.id]);
        fixed++;
      }
    }
    res.json({ total: unknowns.rows.length, fixed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Custom fields do Kommo (para encontrar campo de revenue)
app.get('/api/kommo/custom-fields', authMiddleware, roleMiddleware(...salesAdmin), async (req, res) => {
  try {
    const data = await kommoRequest('GET', '/leads/custom_fields');
    const fields = (data?._embedded?.custom_fields || []).map(f => ({ id: f.id, name: f.name, type: f.type }));
    res.json(fields);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync periódico (roda a cada X minutos via setInterval) ───
let syncInterval = null;

async function runPeriodicSync() {
  try {
    const config = await pool.query('SELECT * FROM kommo_config WHERE connected = true LIMIT 1');
    if (!config.rows.length) return;
    const cfg = config.rows[0];
    if (!cfg.pipeline_id || !cfg.stage_won) return;

    const userMap = await pool.query('SELECT * FROM kommo_user_map WHERE seller_id IS NOT NULL');
    if (!userMap.rows.length) return;
    const map = {};
    for (const um of userMap.rows) map[um.kommo_user_id] = um.seller_id;

    const today = new Date().toISOString().split('T')[0];
    const dayStart = new Date(today + 'T00:00:00').getTime() / 1000;
    const dayEnd = new Date(today + 'T23:59:59').getTime() / 1000;

    let allLeads = [];
    const data = await kommoRequest('GET', `/leads?filter[pipeline_id]=${cfg.pipeline_id}&filter[updated_at][from]=${dayStart}&filter[updated_at][to]=${dayEnd}&limit=250`);
    allLeads = data?._embedded?.leads || [];

    const metrics = {};
    for (const lead of allLeads) {
      const sellerId = map[lead.responsible_user_id];
      if (!sellerId) continue;
      if (!metrics[sellerId]) metrics[sellerId] = { leads_received: 0, leads_responded: 0, conversions: 0, sales_closed: 0, revenue: 0 };
      const m = metrics[sellerId];
      m.leads_received++;
      if (lead.status_id !== cfg.stage_new_lead) m.leads_responded++;
      if (cfg.stage_interested && lead.status_id === cfg.stage_interested) m.conversions++;
      if (lead.status_id === cfg.stage_won) { m.conversions++; m.sales_closed++; m.revenue += parseFloat(lead.price || 0); }
    }

    for (const [sellerId, m] of Object.entries(metrics)) {
      await pool.query(
        `INSERT INTO sales_reports (seller_id, report_date, report_type, leads_received, leads_responded, conversions, sales_closed, revenue, notes)
         VALUES ($1, $2, 'completo', $3, $4, $5, $6, $7, 'Auto-sync Kommo')
         ON CONFLICT (seller_id, report_date, report_type)
         DO UPDATE SET leads_received=$3, leads_responded=$4, conversions=$5, sales_closed=$6, revenue=$7, notes='Auto-sync Kommo', updated_at=NOW()`,
        [parseInt(sellerId), today, m.leads_received, m.leads_responded, m.conversions, m.sales_closed, m.revenue]
      );
    }

    await pool.query(`UPDATE kommo_config SET last_sync_at=NOW()`);
    console.log(`[Kommo Sync] ${allLeads.length} leads processados, ${Object.keys(metrics).length} vendedoras atualizadas`);
  } catch (err) {
    console.error('[Kommo Sync Error]', err.message);
  }
}

// Iniciar sync periódico
async function startPeriodicSync() {
  try {
    const config = await pool.query('SELECT sync_interval_minutes, connected FROM kommo_config LIMIT 1');
    if (config.rows.length && config.rows[0].connected) {
      const interval = (config.rows[0].sync_interval_minutes || 15) * 60 * 1000;
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(runPeriodicSync, interval);
      console.log(`[Kommo] Sync periódico ativado a cada ${config.rows[0].sync_interval_minutes || 15} minutos`);
    }
  } catch {}
}

// ─── Serve static in production ───
app.use(express.static('dist'));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile('dist/index.html', { root: '.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startPeriodicSync();
});
