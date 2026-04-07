import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { design as designApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import generateReport from '../services/generateReport';
import styles from '../styles/DesignAnalytics.module.css';

const STATUS_LABELS = {
  links: 'Links', demanda: 'Demanda', em_andamento: 'Em Andamento', analise: 'Análise',
  alteracoes: 'Alterações', concluidas: 'Concluídas', pos_gestores: 'Pós Gestores', reunioes: 'Reuniões',
};
const STATUS_COLORS = {
  links: '#6c5ce7', demanda: '#C9971A', em_andamento: '#0984e3', analise: '#fdcb6e',
  alteracoes: '#ff6b35', concluidas: '#00b894', pos_gestores: '#a29bfe', reunioes: '#fd79a8',
};
const PRI_COLORS = { normal: '#C9971A', alta: '#ff6b35', urgente: '#ff4757' };
const DESIGNER_COLORS = ['#C9971A', '#0984e3', '#00b894', '#a29bfe', '#fd79a8', '#fdcb6e'];

function BarChart({ data, labelKey, valueKey, color, maxW = 100 }) {
  if (!data?.length) return <p className={styles.empty}>Sem dados</p>;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className={styles.barChart}>
      {data.map((d, i) => (
        <div key={i} className={styles.barRow}>
          <span className={styles.barLabel}>{d[labelKey]}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(d[valueKey] / max) * maxW}%`, background: typeof color === 'string' ? color : color(d, i) }} />
          </div>
          <span className={styles.barVal}>{d[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey, colorFn }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  let cum = 0;
  const slices = data.map((d, i) => {
    const pct = d[valueKey] / total;
    const start = cum;
    cum += pct;
    return { ...d, pct, start, color: colorFn(d, i) };
  });
  // Build conic-gradient
  const gradient = slices.map(s =>
    `${s.color} ${(s.start * 360).toFixed(1)}deg ${((s.start + s.pct) * 360).toFixed(1)}deg`
  ).join(', ');

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ background: `conic-gradient(${gradient})` }}>
        <div className={styles.donutHole}><span>{total}</span><small>total</small></div>
      </div>
      <div className={styles.donutLegend}>
        {slices.map((s, i) => (
          <div key={i} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span>{s[labelKey]}</span>
            <span className={styles.legendVal}>{s[valueKey]} ({Math.round(s.pct * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyChart({ data, designers }) {
  if (!data?.length) return <p className={styles.empty}>Sem dados</p>;
  const weeks = [...new Set(data.map(d => d.week))].sort();
  const designerNames = [...new Set(data.map(d => d.designer_name))];
  const maxVal = Math.max(...weeks.map(w => data.filter(d => d.week === w).reduce((s, d) => s + d.count, 0)), 1);
  const W = 500, H = 200, PAD = 40;
  const barGroupW = (W - PAD * 2) / weeks.length;
  const barW = Math.min(20, (barGroupW - 8) / Math.max(designerNames.length, 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svgChart}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={PAD} y1={PAD + (1 - f) * (H - PAD * 2)} x2={W - PAD} y2={PAD + (1 - f) * (H - PAD * 2)} stroke="#1a1a1a" />
          <text x={PAD - 6} y={PAD + (1 - f) * (H - PAD * 2) + 4} textAnchor="end" fill="#555" fontSize="9">{Math.round(maxVal * f)}</text>
        </g>
      ))}
      {weeks.map((w, wi) => {
        const x0 = PAD + wi * barGroupW + 4;
        return (
          <g key={w}>
            {designerNames.map((dn, di) => {
              const val = data.find(d => d.week === w && d.designer_name === dn)?.count || 0;
              const barH = (val / maxVal) * (H - PAD * 2);
              return (
                <rect key={dn} x={x0 + di * (barW + 2)} y={H - PAD - barH} width={barW} height={barH}
                  rx="2" fill={DESIGNER_COLORS[di % DESIGNER_COLORS.length]} opacity="0.85" />
              );
            })}
            <text x={x0 + (designerNames.length * (barW + 2)) / 2} y={H - 8} textAnchor="middle" fill="#555" fontSize="8">
              {new Date(w).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {designerNames.map((dn, i) => (
        <g key={dn}>
          <rect x={PAD + i * 70} y={4} width={10} height={10} rx="2" fill={DESIGNER_COLORS[i % DESIGNER_COLORS.length]} />
          <text x={PAD + i * 70 + 14} y={13} fill="#999" fontSize="9">{dn}</text>
        </g>
      ))}
    </svg>
  );
}

export default function DesignAnalyticsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [expertStats, setExpertStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});

  useEffect(() => {
    Promise.all([
      designApi.analytics(),
      designApi.expertVideoStats(),
    ]).then(([d, ev]) => {
      setData(d);
      setExpertStats(ev);
      // Expandir o mês atual por padrão
      if (ev?.months?.length) {
        setExpandedMonths({ [ev.months[0].month_key]: true });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleMonth = (key) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) return <div className={styles.page}><div className={styles.loading}>Carregando...</div></div>;
  if (!data) return <div className={styles.page}><div className={styles.loading}>Erro ao carregar dados</div></div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>FUZABALTA</h1>
          <span className={styles.subtitle}>Analytics</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnGold} onClick={() => generateReport(data)}>Baixar PDF</button>
          <button className={styles.btnGhost} onClick={() => navigate('/design/board')}>Voltar ao Board</button>
          <div className={styles.userInfo}>
            <span>{user?.name}</span>
            <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/design'); }}>Sair</button>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {/* Designer cards */}
        <h2 className={styles.sectionTitle}>Produtividade por Designer</h2>
        <div className={styles.designerGrid}>
          {data.perDesigner.map(d => (
            <div key={d.id} className={styles.designerCard}>
              <div className={styles.designerAvatar}>{d.name.slice(0, 2).toUpperCase()}</div>
              <h3>{d.name}</h3>
              <div className={styles.designerStats}>
                <div className={styles.dStat}><span className={styles.dVal}>{d.completed}</span><span className={styles.dLbl}>Concluídos</span></div>
                <div className={styles.dStat}><span className={styles.dVal}>{d.active}</span><span className={styles.dLbl}>Ativos</span></div>
                <div className={`${styles.dStat} ${d.overdue > 0 ? styles.dDanger : ''}`}><span className={styles.dVal}>{d.overdue}</span><span className={styles.dLbl}>Atrasados</span></div>
              </div>
              <div className={styles.designerMeta}>
                <div className={styles.metaRow}>
                  <span>Tempo médio de conclusão</span>
                  <strong>{d.avg_hours_to_complete > 0 ? `${d.avg_hours_to_complete}h` : '—'}</strong>
                </div>
                <div className={styles.metaRow}>
                  <span>Horas estimadas entregues</span>
                  <strong>{d.total_estimated_hours > 0 ? `${d.total_estimated_hours}h` : '—'}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vídeos por Expert — histórico mensal */}
        {expertStats?.months?.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Vídeos por Expert</h2>
            <div className={styles.expertMonthsList}>
              {expertStats.months.map(m => (
                <div key={m.month_key} className={styles.expertMonthBlock}>
                  <button className={styles.expertMonthHeader} onClick={() => toggleMonth(m.month_key)}>
                    <div className={styles.expertMonthLeft}>
                      <span className={styles.expertMonthArrow}>{expandedMonths[m.month_key] ? '▼' : '▶'}</span>
                      <span className={styles.expertMonthTitle}>{m.month_label}</span>
                    </div>
                    <div className={styles.expertMonthSummary}>
                      <span className={styles.expertMonthBadge}>{m.total_experts} expert{m.total_experts !== 1 ? 's' : ''}</span>
                      <span className={styles.expertMonthBadgeGold}>{m.total_videos} vídeo{m.total_videos !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                  {expandedMonths[m.month_key] && (
                    <div className={styles.expertGrid}>
                      {m.experts.map((ex, i) => (
                        <div key={i} className={styles.expertCard}>
                          <div className={styles.expertAvatar}>{ex.expert_name.slice(0, 2).toUpperCase()}</div>
                          <div className={styles.expertInfo}>
                            <span className={styles.expertName}>{ex.expert_name}</span>
                            <span className={styles.expertCount}>{ex.video_count} vídeo{ex.video_count !== 1 ? 's' : ''}</span>
                          </div>
                          <span className={styles.expertCountBig}>{ex.video_count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Charts grid */}
        <div className={styles.chartsGrid}>
          {/* Weekly output */}
          <div className={styles.chartCard}>
            <h3>Entregas por Semana</h3>
            <WeeklyChart data={data.weeklyOutput} />
          </div>

          {/* Status distribution */}
          <div className={styles.chartCard}>
            <h3>Distribuição por Status</h3>
            <DonutChart data={data.byStatus} labelKey="status" valueKey="count"
              colorFn={(d) => STATUS_COLORS[d.status] || '#555'} />
          </div>

          {/* Priority distribution */}
          <div className={styles.chartCard}>
            <h3>Prioridades (cards ativos)</h3>
            <DonutChart data={data.byPriority} labelKey="priority" valueKey="count"
              colorFn={(d) => PRI_COLORS[d.priority] || '#555'} />
          </div>

          {/* By type */}
          <div className={styles.chartCard}>
            <h3>Por Tipo de Entrega</h3>
            <BarChart data={data.byType} labelKey="delivery_type" valueKey="count" color="#C9971A" />
          </div>

          {/* Rework */}
          <div className={styles.chartCard}>
            <h3>Alterações (Retrabalho)</h3>
            <BarChart data={data.rework} labelKey="name" valueKey="alteracoes" color="#ff6b35" />
          </div>

          {/* Slowest cards */}
          <div className={styles.chartCard}>
            <h3>Cards Mais Demorados</h3>
            {data.slowest.length > 0 ? (
              <div className={styles.slowList}>
                {data.slowest.map((s, i) => (
                  <div key={i} className={styles.slowItem}>
                    <span className={styles.slowRank}>#{i + 1}</span>
                    <div className={styles.slowInfo}>
                      <span className={styles.slowTitle}>{s.title}</span>
                      <span className={styles.slowMeta}>{s.designer_name} &middot; estimado: {s.estimated_hours || '—'}h</span>
                    </div>
                    <span className={styles.slowTime}>{s.hours_taken}h</span>
                  </div>
                ))}
              </div>
            ) : <p className={styles.empty}>Nenhum card concluído ainda</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
