import { useState, useEffect, useCallback } from 'react';
import { scrum as scrumApi, demands as demandsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/ScrumPage.module.css';

function BurndownChart({ data }) {
  if (!data || !data.points?.length) return <div className={styles.emptyChart}>Sem dados de burndown</div>;
  const { total, points } = data;
  const W = 600, H = 280, PAD = 40;
  const maxY = total || 1;
  const xStep = (W - PAD * 2) / Math.max(1, points.length - 1);
  const yScale = (v) => PAD + ((maxY - v) / maxY) * (H - PAD * 2);
  const xScale = (i) => PAD + i * xStep;

  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.ideal)}`).join(' ');
  const today = new Date().toISOString().split('T')[0];
  const actualPoints = points.filter(p => p.date <= today);
  const actualPath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p.actual)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={PAD} y1={yScale(maxY * f)} x2={W - PAD} y2={yScale(maxY * f)} stroke="var(--border)" strokeDasharray="3,3" />
          <text x={PAD - 8} y={yScale(maxY * f) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10">{Math.round(maxY * f)}</text>
        </g>
      ))}
      {/* Ideal line */}
      <path d={idealPath} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.6" />
      {/* Actual line */}
      {actualPath && <path d={actualPath} fill="none" stroke="var(--accent-purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Points on actual */}
      {actualPoints.map((p, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(p.actual)} r="3.5" fill="var(--accent-purple)" stroke="var(--bg-secondary)" strokeWidth="1.5" />
      ))}
      {/* X axis labels */}
      {points.filter((_, i) => i % Math.ceil(points.length / 7) === 0 || i === points.length - 1).map((p, _, arr) => {
        const idx = points.indexOf(p);
        return (
          <text key={p.date} x={xScale(idx)} y={H - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
            {p.date.slice(5)}
          </text>
        );
      })}
      {/* Legend */}
      <line x1={W - 140} y1={15} x2={W - 120} y2={15} stroke="var(--accent-purple)" strokeWidth="2.5" />
      <text x={W - 115} y={18} fill="var(--text-secondary)" fontSize="10">Real</text>
      <line x1={W - 75} y1={15} x2={W - 55} y2={15} stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x={W - 50} y={18} fill="var(--text-secondary)" fontSize="10">Ideal</text>
    </svg>
  );
}

function VelocityChart({ data }) {
  if (!data?.length) return <div className={styles.emptyChart}>Sem dados de velocity</div>;
  const W = 600, H = 200, PAD = 40;
  const maxV = Math.max(...data.map(d => d.velocity), 1);
  const barW = Math.min(50, (W - PAD * 2) / data.length - 10);
  const avg = data.reduce((s, d) => s + d.velocity, 0) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      {/* Avg line */}
      <line x1={PAD} y1={PAD + ((maxV - avg) / maxV) * (H - PAD * 2)} x2={W - PAD} y2={PAD + ((maxV - avg) / maxV) * (H - PAD * 2)} stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="5,3" />
      <text x={W - PAD + 4} y={PAD + ((maxV - avg) / maxV) * (H - PAD * 2) + 4} fill="var(--accent-cyan)" fontSize="9">avg {Math.round(avg)}</text>
      {data.map((d, i) => {
        const x = PAD + (i / data.length) * (W - PAD * 2) + barW / 2;
        const barH = (d.velocity / maxV) * (H - PAD * 2);
        const y = H - PAD - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="4" fill="var(--accent-purple)" opacity="0.8" />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">{d.velocity}</text>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="8">{d.name?.slice(0, 8)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ScrumPage() {
  const { isAdmin } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [burndown, setBurndown] = useState(null);
  const [velocity, setVelocity] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteType, setNoteType] = useState('standup');
  const [noteContent, setNoteContent] = useState('');
  const [tab, setTab] = useState('overview');
  const [showNewSprint, setShowNewSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: '', goal: '', start_date: '', end_date: '' });
  const [sprintDemands, setSprintDemands] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [sprintList, vel] = await Promise.all([scrumApi.sprints(), scrumApi.velocity()]);
      setSprints(sprintList);
      setVelocity(vel);
      const active = sprintList.find(s => s.status === 'active');
      setActiveSprint(active || null);
      if (active) {
        const [bd, n, d] = await Promise.all([
          scrumApi.burndown(active.id).catch(() => null),
          scrumApi.notes(active.id).catch(() => []),
          demandsApi.list({ sprint_id: active.id }).catch(() => []),
        ]);
        setBurndown(bd);
        setNotes(n);
        setSprintDemands(d);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    await scrumApi.createSprint(newSprint);
    setNewSprint({ name: '', goal: '', start_date: '', end_date: '' });
    setShowNewSprint(false);
    loadData();
  };

  const handleStartSprint = async (id) => {
    await scrumApi.startSprint(id);
    loadData();
  };

  const handleCloseSprint = async (id) => {
    if (!confirm('Fechar esta sprint? A velocity será calculada automaticamente.')) return;
    await scrumApi.closeSprint(id);
    loadData();
  };

  const handleAddNote = async () => {
    if (!noteContent.trim() || !activeSprint) return;
    await scrumApi.addNote(activeSprint.id, noteType, noteContent);
    setNoteContent('');
    const n = await scrumApi.notes(activeSprint.id);
    setNotes(n);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const progressPct = activeSprint
    ? Math.round((activeSprint.completed_demands / Math.max(1, activeSprint.total_demands)) * 100)
    : 0;

  const NOTE_TYPES = [
    { value: 'standup', label: 'Daily Standup' },
    { value: 'impediment', label: 'Impedimento' },
    { value: 'retrospective', label: 'Retrospectiva' },
    { value: 'review', label: 'Sprint Review' },
    { value: 'planning', label: 'Planning' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.topBar}>
          <h1>Scrum Master</h1>
          <button className="btn btn-primary" onClick={() => setShowNewSprint(!showNewSprint)}>
            {showNewSprint ? 'Cancelar' : '+ Nova Sprint'}
          </button>
        </div>

        {showNewSprint && (
          <form className={styles.newSprintForm} onSubmit={handleCreateSprint}>
            <input placeholder="Nome da Sprint" value={newSprint.name} onChange={e => setNewSprint(p => ({ ...p, name: e.target.value }))} required />
            <input placeholder="Objetivo da Sprint" value={newSprint.goal} onChange={e => setNewSprint(p => ({ ...p, goal: e.target.value }))} />
            <input type="date" value={newSprint.start_date} onChange={e => setNewSprint(p => ({ ...p, start_date: e.target.value }))} required />
            <input type="date" value={newSprint.end_date} onChange={e => setNewSprint(p => ({ ...p, end_date: e.target.value }))} required />
            <button type="submit" className="btn btn-primary btn-sm">Criar Sprint</button>
          </form>
        )}

        {/* Active Sprint Banner */}
        {activeSprint ? (
          <div className={styles.activeBanner}>
            <div className={styles.bannerLeft}>
              <div className={styles.bannerTitle}>
                <span className={styles.liveIndicator} />
                <h2>{activeSprint.name}</h2>
                <span className={styles.bannerDates}>{formatDate(activeSprint.start_date)} → {formatDate(activeSprint.end_date)}</span>
              </div>
              {activeSprint.goal && <p className={styles.bannerGoal}>{activeSprint.goal}</p>}
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div className={styles.bannerStats}>
              <div className={styles.bannerStat}>
                <span className={styles.statNum}>{activeSprint.completed_demands}/{activeSprint.total_demands}</span>
                <span className={styles.statLabel}>Demandas</span>
              </div>
              <div className={styles.bannerStat}>
                <span className={styles.statNum}>{activeSprint.completed_points}/{activeSprint.total_points}</span>
                <span className={styles.statLabel}>Story Points</span>
              </div>
              <div className={styles.bannerStat}>
                <span className={styles.statNum}>{progressPct}%</span>
                <span className={styles.statLabel}>Progresso</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleCloseSprint(activeSprint.id)}>Fechar Sprint</button>
            </div>
          </div>
        ) : (
          <div className={styles.noActive}>Nenhuma sprint ativa. Crie e inicie uma sprint para começar.</div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          {['overview', 'notes', 'sprints'].map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Gráficos' : t === 'notes' ? 'Standups & Notas' : 'Todas as Sprints'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3>Burndown Chart</h3>
              <BurndownChart data={burndown} />
            </div>
            <div className={styles.chartCard}>
              <h3>Velocity</h3>
              <VelocityChart data={velocity} />
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className={styles.notesSection}>
            {activeSprint && (
              <div className={styles.noteForm}>
                <div className={styles.noteFormTop}>
                  <select value={noteType} onChange={e => setNoteType(e.target.value)}>
                    {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Adicionar</button>
                </div>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder={noteType === 'standup'
                    ? 'O que fiz ontem? O que farei hoje? Algum impedimento?'
                    : noteType === 'retrospective'
                    ? 'O que foi bom? O que pode melhorar? Ações para próxima sprint?'
                    : 'Detalhes...'}
                  rows={3}
                />
              </div>
            )}
            <div className={styles.notesList}>
              {notes.map(n => (
                <div key={n.id} className={styles.noteCard}>
                  <div className={styles.noteHeader}>
                    <span className={`${styles.noteTypeBadge} ${styles[`note_${n.type}`]}`}>{NOTE_TYPES.find(t => t.value === n.type)?.label}</span>
                    <span className={styles.noteAuthor}>{n.user_name}</span>
                    <span className={styles.noteDate}>{formatDate(n.created_at)}</span>
                  </div>
                  <p className={styles.noteBody}>{n.content}</p>
                </div>
              ))}
              {notes.length === 0 && <div className={styles.empty}>Nenhuma nota nesta sprint.</div>}
            </div>
          </div>
        )}

        {tab === 'sprints' && (
          <div className={styles.sprintsList}>
            {sprints.map(s => (
              <div key={s.id} className={`${styles.sprintCard} ${styles[`sprint_${s.status}`]}`}>
                <div className={styles.sprintInfo}>
                  <div className={styles.sprintHeader}>
                    <span className={styles.sprintStatus}>{s.status}</span>
                    <h3>{s.name}</h3>
                  </div>
                  <span className={styles.sprintDates}>{formatDate(s.start_date)} → {formatDate(s.end_date)}</span>
                  {s.goal && <p className={styles.sprintGoal}>{s.goal}</p>}
                </div>
                <div className={styles.sprintStats}>
                  <span>{s.total_demands} demandas</span>
                  <span>{s.total_points} pts</span>
                  {s.velocity > 0 && <span className={styles.velocityBadge}>Vel: {s.velocity}</span>}
                  {s.status === 'planning' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleStartSprint(s.id)}>Iniciar</button>
                  )}
                  {s.status === 'active' && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleCloseSprint(s.id)}>Fechar</button>
                  )}
                </div>
              </div>
            ))}
            {sprints.length === 0 && <div className={styles.empty}>Nenhuma sprint criada ainda.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
