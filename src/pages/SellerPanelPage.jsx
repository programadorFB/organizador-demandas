import { useState, useEffect, useCallback } from 'react';
import { sales } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import SalesChat from '../components/SalesChat';
import KnowledgeBase from '../components/KnowledgeBase';
import ThemeSettings from '../components/ThemeSettings';
import styles from '../styles/SellerPanel.module.css';

export default function SellerPanelPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeShift, setActiveShift] = useState('manha');
  const [activeTab, setActiveTab] = useState('painel');

  const today = new Date().toISOString().split('T')[0];
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const monthLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const [form, setForm] = useState({
    report_date: today,
    report_type: 'manha',
    leads_received: '',
    leads_responded: '',
    conversions: '',
    sales_closed: '',
    revenue: '',
    notes: '',
  });

  const loadDashboard = useCallback(async () => {
    try { setDashboard(await sales.dashboard()); } catch {}
  }, []);

  const loadReports = useCallback(async () => {
    try { setReports(await sales.myReports(30)); } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadDashboard(), loadReports()]).finally(() => setLoading(false));
  }, [loadDashboard, loadReports]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const switchShift = (s) => {
    setActiveShift(s);
    setForm(prev => ({ ...prev, report_type: s }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await sales.submitReport({
        ...form,
        leads_received: parseInt(form.leads_received) || 0,
        leads_responded: parseInt(form.leads_responded) || 0,
        conversions: parseInt(form.conversions) || 0,
        sales_closed: parseInt(form.sales_closed) || 0,
        revenue: parseFloat(form.revenue) || 0,
      });
      setSuccess(`Relatorio ${form.report_type === 'manha' ? 'Manha' : 'Completo'} enviado com sucesso!`);
      setForm(prev => ({ ...prev, leads_received: '', leads_responded: '', conversions: '', sales_closed: '', revenue: '', notes: '' }));
      loadDashboard(); loadReports();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleClear = () => {
    setForm(prev => ({ ...prev, leads_received: '', leads_responded: '', conversions: '', sales_closed: '', revenue: '', notes: '' }));
  };

  const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '--';
  const calcRate = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : '--.--';

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) return <div className={styles.loadWrap}><div className={styles.spinner} /><p>Carregando...</p></div>;

  const m = dashboard?.monthly || {};
  const seller = dashboard?.seller || {};
  const goalLeads = seller.monthly_goal_leads || 0;
  const goalSales = seller.monthly_goal_sales || 0;
  const goalRevenue = parseFloat(seller.monthly_goal_revenue) || 0;

  const salesProgress = goalSales > 0 ? Math.min(((m.sales || 0) / goalSales) * 100, 100) : 0;
  const revenueProgress = goalRevenue > 0 ? Math.min((parseFloat(m.revenue || 0) / goalRevenue) * 100, 100) : 0;
  const convRate = (m.leads || 0) > 0 ? ((m.sales || 0) / m.leads * 100).toFixed(1) : '0.0';
  const goalConv = 25; // meta padrao conversao
  const convProgress = Math.min((parseFloat(convRate) / goalConv) * 100, 100);

  // Preview metricas
  const pLeads = parseInt(form.leads_received) || 0;
  const pResp = parseInt(form.leads_responded) || 0;
  const pConv = parseInt(form.conversions) || 0;
  const pSales = parseInt(form.sales_closed) || 0;
  const pRevenue = parseFloat(form.revenue) || 0;
  const pTicket = pSales > 0 ? (pRevenue / pSales) : 0;

  // Checar se ja enviou relatorio de cada turno hoje
  const todayReports = reports.filter(r => r.report_date?.startsWith(today));
  const manhaEnviado = todayReports.some(r => r.report_type === 'manha');
  const completoEnviado = todayReports.some(r => r.report_type === 'completo');

  // Stats do dia (do relatorio de hoje)
  const todaySales = todayReports.reduce((s, r) => s + (r.sales_closed || 0), 0);
  const todayRevenue = todayReports.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.avatar}>{user.name?.charAt(0)}</div>
          <div>
            <div className={styles.hName}>{user.name}</div>
            <div className={styles.hRole}>Vendedora</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.hDate}>{todayLabel}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
        </div>
      </header>


      {/* Tab navigation */}
      <div className={styles.tabNav}>
        <button className={`${styles.tabBtn} ${activeTab === 'painel' ? styles.tabActive : ''}`} onClick={() => setActiveTab('painel')}>Meu Painel</button>
        <button className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.tabActive : ''}`} onClick={() => setActiveTab('chat')}>Chat da Equipe</button>
        <button className={`${styles.tabBtn} ${activeTab === 'conhecimento' ? styles.tabActive : ''}`} onClick={() => setActiveTab('conhecimento')}>Conhecimento</button>
        <button className={`${styles.tabBtn} ${activeTab === 'aparencia' ? styles.tabActive : ''}`} onClick={() => setActiveTab('aparencia')}>Aparencia</button>
      </div>

      {activeTab === 'chat' && <SalesChat />}
      {activeTab === 'conhecimento' && <KnowledgeBase />}
      {activeTab === 'aparencia' && (
        <div className={styles.content}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Personalizar Aparencia</h3>
            <ThemeSettings />
          </div>
        </div>
      )}

      {activeTab === 'painel' && <div className={styles.content}>
        {/* ─── METAS ─── */}
        <div className={styles.goalsBox}>
          <h3 className={styles.goalsTitle}>Suas Metas - {monthLabel}</h3>
          <div className={styles.goalRow}>
            <div className={styles.goalLabel}><span>Vendas do Mes</span><span className={styles.goalNums}>{m.sales || 0} / {goalSales}</span></div>
            <div className={styles.goalTrack}><div className={styles.goalFill} style={{ width: `${salesProgress}%`, background: '#e17055' }} /></div>
          </div>
          <div className={styles.goalRow}>
            <div className={styles.goalLabel}><span>Faturamento</span><span className={styles.goalNums}>{fmt(m.revenue)} / {fmt(goalRevenue)}</span></div>
            <div className={styles.goalTrack}><div className={styles.goalFill} style={{ width: `${revenueProgress}%`, background: 'var(--accent-green)' }} /></div>
          </div>
          <div className={styles.goalRow}>
            <div className={styles.goalLabel}><span>Taxa de Conversao</span><span className={styles.goalNums}>{convRate}% / {goalConv}%</span></div>
            <div className={styles.goalTrack}><div className={styles.goalFill} style={{ width: `${convProgress}%`, background: 'var(--accent-cyan)' }} /></div>
          </div>
        </div>

        {/* ─── TURNO TOGGLE ─── */}
        <div className={styles.shiftToggle}>
          <button className={`${styles.shiftBtn} ${styles.shiftManha} ${activeShift === 'manha' ? styles.shiftActive : ''}`} onClick={() => switchShift('manha')}>
            <span className={styles.shiftIcon}>*</span> 09h-14h
            <span className={styles.shiftSub}>Relatorio da Manha</span>
          </button>
          <button className={`${styles.shiftBtn} ${styles.shiftCompleto} ${activeShift === 'completo' ? styles.shiftActive : ''}`} onClick={() => switchShift('completo')}>
            <span className={styles.shiftIcon}>&#9789;</span> 09h-18h
            <span className={styles.shiftSub}>Relatorio Completo</span>
          </button>
        </div>

        {/* ─── STATUS CARDS ─── */}
        <div className={styles.statusRow}>
          <div className={styles.statusCard}>
            <span className={styles.statusLabel}>STATUS MANHA</span>
            <span className={manhaEnviado ? styles.statusSent : styles.statusPending}>
              {manhaEnviado ? 'Enviado' : 'Pendente'}
            </span>
          </div>
          <div className={styles.statusCard}>
            <span className={styles.statusLabel}>STATUS COMPLETO</span>
            <span className={completoEnviado ? styles.statusSent : styles.statusPending}>
              {completoEnviado ? 'Enviado' : 'Pendente'}
            </span>
          </div>
          <div className={styles.statusCard}>
            <span className={styles.statusLabel}>VENDAS HOJE</span>
            <span className={styles.statusBig}>{todaySales}</span>
            <span className={styles.statusSmall}>{fmt(todayRevenue)}</span>
          </div>
          <div className={styles.statusCard}>
            <span className={styles.statusLabel}>SUA CONVERSAO</span>
            <span className={styles.statusBig}>{convRate}%</span>
            <span className={styles.statusSmall}>{parseFloat(convRate) >= goalConv ? 'Acima da media' : 'Abaixo da meta'}</span>
          </div>
        </div>

        {/* ─── FORMULARIO ─── */}
        {success && <div className={styles.successBanner}>{success}</div>}
        {error && <div className={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.reportForm}>
          <h3 className={styles.formTitle}>Relatorio - {activeShift === 'manha' ? 'Turno da Manha' : 'Dia Completo'}</h3>
          <p className={styles.formDesc}>Preencha os dados do periodo {activeShift === 'manha' ? '09h as 14h' : '09h as 18h'}</p>

          <div className={styles.formGrid}>
            <div className={styles.ff}>
              <label>LEADS RECEBIDOS (TRAFEGO)</label>
              <input type="number" min="0" value={form.leads_received} onChange={set('leads_received')} placeholder="Ex: 58" />
              <span className={styles.ffHint}>Quantas pessoas chegaram do trafego pago</span>
            </div>
            <div className={styles.ff}>
              <label>LEADS RESPONDIDOS</label>
              <input type="number" min="0" value={form.leads_responded} onChange={set('leads_responded')} placeholder="Ex: 52" />
              <span className={styles.ffHint}>Quantas voce conseguiu responder</span>
            </div>
            <div className={styles.ff}>
              <label>CONVERSOES (DEMONSTRARAM INTERESSE)</label>
              <input type="number" min="0" value={form.conversions} onChange={set('conversions')} placeholder="Ex: 14" />
              <span className={styles.ffHint}>Quantas demonstraram interesse real</span>
            </div>
            <div className={styles.ff}>
              <label>VENDAS FECHADAS</label>
              <input type="number" min="0" value={form.sales_closed} onChange={set('sales_closed')} placeholder="Ex: 10" />
              <span className={styles.ffHint}>Quantas vendas voce fechou neste turno</span>
            </div>
            <div className={styles.ff}>
              <label>FATURAMENTO TOTAL (R$)</label>
              <input type="number" step="0.01" min="0" value={form.revenue} onChange={set('revenue')} placeholder="Ex: 8200" />
              <span className={styles.ffHint}>Valor total das vendas deste turno</span>
            </div>
            <div className={styles.ff}>
              <label>TICKET MEDIO (R$)</label>
              <input type="text" value={pSales > 0 ? fmt(pTicket) : ''} readOnly placeholder="Calculado automaticamente" className={styles.readonlyInput} />
            </div>
          </div>

          <div className={styles.ffFull}>
            <label>OBSERVACOES (OPCIONAL)</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Anote aqui dificuldades, feedbacks de clientes, sugestoes..." rows={3} />
          </div>

          {/* Metricas calculadas */}
          <div className={styles.calcBox}>
            <h4>SUAS METRICAS (CALCULADAS AUTOMATICAMENTE)</h4>
            <div className={styles.calcGrid}>
              <div className={styles.calcItem}>
                <span>Taxa de Resposta</span>
                <span className={styles.calcVal}>{pLeads > 0 ? calcRate(pResp, pLeads) : '--.--'}%</span>
              </div>
              <div className={styles.calcItem}>
                <span>Taxa de Conversao (leads &gt; conversao)</span>
                <span className={styles.calcVal}>{pLeads > 0 ? calcRate(pConv, pLeads) : '--.--'}%</span>
              </div>
              <div className={styles.calcItem}>
                <span>Taxa de Fechamento (conversao &gt; venda)</span>
                <span className={styles.calcVal}>{pConv > 0 ? calcRate(pSales, pConv) : '--.--'}%</span>
              </div>
              <div className={styles.calcItem}>
                <span>Aproveitamento Geral (leads &gt; venda)</span>
                <span className={styles.calcVal}>{pLeads > 0 ? calcRate(pSales, pLeads) : '--.--'}%</span>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.clearBtn} onClick={handleClear}>LIMPAR</button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Enviando...' : 'ENVIAR RELATORIO'}
            </button>
          </div>
        </form>

        {/* ─── HISTORICO ─── */}
        <div className={styles.historyBox}>
          <h3 className={styles.histTitle}>Seus Ultimos Relatorios</h3>
          <div className={styles.histList}>
            {reports.map(r => (
              <div key={r.id} className={styles.histRow}>
                <div className={styles.histDate}>
                  <span className={styles.histDateMain}>{fmtDate(r.report_date)}</span>
                  <span className={styles.histShift}>{r.report_type === 'manha' ? 'TURNO MANHA (09H-14H)' : 'DIA COMPLETO (09H-18H)'}</span>
                </div>
                <div className={styles.histStats}>
                  <div className={styles.histStat}><span className={styles.histNum}>{r.leads_received}</span><span className={styles.histLbl}>LEADS</span></div>
                  <div className={styles.histStat}><span className={styles.histNum}>{r.leads_responded}</span><span className={styles.histLbl}>RESPOND.</span></div>
                  <div className={styles.histStat}><span className={styles.histNum}>{r.conversions}</span><span className={styles.histLbl}>CONV.</span></div>
                  <div className={styles.histStat}><span className={styles.histNum}>{r.sales_closed}</span><span className={styles.histLbl}>VENDAS</span></div>
                  <div className={styles.histStat}><span className={`${styles.histNum} ${styles.green}`}>{fmt(r.revenue)}</span><span className={styles.histLbl}>FATUR.</span></div>
                </div>
                <span className={styles.histBadge}>Enviado</span>
              </div>
            ))}
            {reports.length === 0 && <div className={styles.empty}>Nenhum relatorio enviado ainda.</div>}
          </div>
        </div>
      </div>}
    </div>
  );
}
