import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { readFileSync } from 'fs';
import { exec } from 'child_process';

const app = express();
const { Pool } = pg;
const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json());

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
    if (!['admin', 'supervisor', 'user'].includes(role)) {
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

// ─── Serve static in production ───
app.use(express.static('dist'));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile('dist/index.html', { root: '.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
