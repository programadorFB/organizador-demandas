import { useState, useEffect, useCallback } from 'react';
import { sales, kommo } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import SalesChat from '../components/SalesChat';
import KnowledgeBase from '../components/KnowledgeBase';
import { generateSalesPDF, generateSalesExcel, generateSellerPDF, generateSellerExcel } from '../services/generateSalesReport';
import ThemeSettings from '../components/ThemeSettings';
import styles from '../styles/SalesDashboard.module.css';

const MONTHS = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SELLER_COLORS = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#00cec9','#a29bfe','#fab1a0','#74b9ff','#55efc4','#ff7675'];

// ─── Componente de Configuração Kommo ───
function KommoConfig({ sellers }) {
  const [configTab, setConfigTab] = useState('conexao');
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ subdomain: '', client_id: '', client_secret: '', redirect_uri: '' });
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [stageMap, setStageMap] = useState({ stage_new_lead: '', stage_responded: '', stage_interested: '', stage_won: '', stage_lost: '' });
  const [kommoUsers, setKommoUsers] = useState([]);
  const [userMap, setUserMap] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncDate, setSyncDate] = useState(new Date().toISOString().split('T')[0]);
  const [webhookStats, setWebhookStats] = useState(null);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kommo.getConfig().then(c => {
      setCfg(c);
      if (c) setForm({ subdomain: c.subdomain || '', client_id: c.client_id || '', client_secret: '', redirect_uri: c.redirect_uri || '' });
      if (c) setStageMap({ stage_new_lead: c.stage_new_lead || '', stage_responded: c.stage_responded || '', stage_interested: c.stage_interested || '', stage_won: c.stage_won || '', stage_lost: c.stage_lost || '' });
    }).catch(() => {}).finally(() => setLoading(false));

    // Listener para callback OAuth
    const handler = (e) => { if (e.data === 'kommo_connected') { kommo.getConfig().then(setCfg); setMsg('Kommo conectado com sucesso!'); } };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const saveConfig = async (e) => {
    e.preventDefault();
    try {
      const result = await kommo.saveConfig(form);
      setCfg(result); setMsg('Configuracao salva!');
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const connectKommo = () => {
    if (!cfg?.subdomain || !cfg?.client_id) { setMsg('Salve a configuracao primeiro'); return; }
    window.open(`https://www.kommo.com/oauth?client_id=${cfg.client_id}&state=kommo_auth&mode=popup`, 'kommo_auth', 'width=600,height=600');
  };

  const disconnectKommo = async () => {
    if (!confirm('Desconectar Kommo?')) return;
    await kommo.disconnect();
    const c = await kommo.getConfig();
    setCfg(c); setMsg('Desconectado.');
  };

  const loadPipelines = async () => {
    try {
      const p = await kommo.getPipelines();
      setPipelines(p);
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const selectPipeline = (p) => {
    setSelectedPipeline(p);
    // Auto-preencher stages se possível
    const stages = p.statuses || [];
    if (stages.length) {
      setStageMap(prev => ({
        ...prev,
        stage_new_lead: stages[0]?.id || '',
      }));
    }
  };

  const savePipelineConfig = async () => {
    if (!selectedPipeline) { setMsg('Selecione um pipeline'); return; }
    try {
      await kommo.savePipelineConfig({
        pipeline_id: selectedPipeline.id,
        pipeline_name: selectedPipeline.name,
        ...stageMap,
      });
      const c = await kommo.getConfig();
      setCfg(c);
      setMsg('Pipeline configurado!');
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const loadKommoUsers = async () => {
    try {
      const [users, map] = await Promise.all([kommo.getKommoUsers(), kommo.getUserMap()]);
      setKommoUsers(users);
      setUserMap(map);
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const handleAutoMap = async () => {
    try {
      const result = await kommo.autoMap();
      setMsg(`Auto-mapeamento: ${result.mapped}/${result.total} users mapeados por email`);
      loadKommoUsers();
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const handleMapUser = async (kommoUserId, sellerId) => {
    try {
      await kommo.mapUser(kommoUserId, sellerId || null);
      loadKommoUsers();
    } catch (err) { setMsg('Erro: ' + err.message); }
  };

  const handleSync = async () => {
    setSyncing(true); setMsg('');
    try {
      const result = await kommo.sync(syncDate);
      setMsg(`Sync concluido: ${result.leads_processed} leads processados, ${result.reports_created} relatorios criados`);
      loadSyncLogs();
    } catch (err) { setMsg('Erro: ' + err.message); }
    finally { setSyncing(false); }
  };

  const loadSyncLogs = async () => {
    try { setSyncLogs(await kommo.getSyncLogs()); } catch {}
  };

  const loadWebhookData = async () => {
    try {
      const [stats, events] = await Promise.all([kommo.getWebhookStats(), kommo.getWebhookEvents(30)]);
      setWebhookStats(stats);
      setWebhookEvents(events);
    } catch {}
  };

  const fmtDt = (d) => d ? new Date(d).toLocaleString('pt-BR') : '--';

  if (loading) return <div className={styles.configSection}><p>Carregando...</p></div>;

  return (
    <>
      <div className={styles.topBar}>
        <h1 className={styles.pageTitle}>Configuracoes - Kommo CRM</h1>
        {cfg?.connected && <span className={styles.connBadge}>Conectado</span>}
        {cfg && !cfg.connected && <span className={styles.disconnBadge}>Desconectado</span>}
      </div>

      {msg && <div className={styles.alertBar}><div className={styles.alertItem}><span>{msg}</span></div></div>}

      {/* Sub-tabs */}
      <div className={styles.shiftTabs} style={{ marginBottom: '1.2rem' }}>
        <button className={`${styles.shiftTab} ${configTab === 'conexao' ? styles.shiftActive : ''}`} onClick={() => setConfigTab('conexao')}>Conexao</button>
        <button className={`${styles.shiftTab} ${configTab === 'pipeline' ? styles.shiftActive : ''}`} onClick={() => { setConfigTab('pipeline'); if (cfg?.connected) loadPipelines(); }}>Pipeline</button>
        <button className={`${styles.shiftTab} ${configTab === 'users' ? styles.shiftActive : ''}`} onClick={() => { setConfigTab('users'); if (cfg?.connected) loadKommoUsers(); }}>Mapeamento Users</button>
        <button className={`${styles.shiftTab} ${configTab === 'sync' ? styles.shiftActive : ''}`} onClick={() => { setConfigTab('sync'); loadSyncLogs(); }}>Sync</button>
        <button className={`${styles.shiftTab} ${configTab === 'webhook' ? styles.shiftActive : ''}`} onClick={() => { setConfigTab('webhook'); loadWebhookData(); }}>Webhook</button>
      </div>

      {/* ── CONEXAO ── */}
      {configTab === 'conexao' && (
        <div className={styles.configSection}>
          <h3 className={styles.configSubtitle}>Credenciais OAuth2</h3>
          <p className={styles.configDesc}>
            Crie uma integracao em Kommo: Configuracoes &gt; Integracoes &gt; Criar Integracao. Copie o Client ID e Secret.
          </p>
          <form onSubmit={saveConfig} className={styles.configForm}>
            <div className={styles.ffRow}>
              <div className={styles.ff}><label>Subdominio Kommo</label><input type="text" value={form.subdomain} onChange={e => setForm(p => ({ ...p, subdomain: e.target.value }))} placeholder="suaempresa" required /></div>
              <div className={styles.ff}><label>Client ID</label><input type="text" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} placeholder="xxxxxxxx-xxxx..." required /></div>
            </div>
            <div className={styles.ffRow}>
              <div className={styles.ff}><label>Client Secret</label><input type="password" value={form.client_secret} onChange={e => setForm(p => ({ ...p, client_secret: e.target.value }))} placeholder="Preencha para atualizar" /></div>
              <div className={styles.ff}><label>Redirect URI</label><input type="text" value={form.redirect_uri} onChange={e => setForm(p => ({ ...p, redirect_uri: e.target.value }))} placeholder="Auto-detectado" /></div>
            </div>
            <div className={styles.modalBtns}>
              <button type="submit" className="btn btn-primary">Salvar Credenciais</button>
              {cfg && !cfg.connected && <button type="button" className="btn btn-success" onClick={connectKommo}>Conectar Kommo</button>}
              {cfg?.connected && <button type="button" className="btn btn-danger" onClick={disconnectKommo}>Desconectar</button>}
            </div>
          </form>
          {cfg && (
            <div className={styles.configInfo}>
              <p><strong>Webhook URL:</strong> <code>https://demandas.sortehub.online/api/kommo/webhook</code></p>
              <p className={styles.configHint}>Configure este URL nas webhooks da sua integracao Kommo para receber updates em tempo real.</p>
            </div>
          )}
        </div>
      )}

      {/* ── PIPELINE ── */}
      {configTab === 'pipeline' && (
        <div className={styles.configSection}>
          <h3 className={styles.configSubtitle}>Configurar Pipeline e Stages</h3>
          <p className={styles.configDesc}>
            Selecione o pipeline de vendas e mapeie cada etapa para as metricas do sistema.
          </p>
          {!cfg?.connected ? (
            <p className={styles.configWarn}>Conecte o Kommo primeiro na aba Conexao.</p>
          ) : (
            <>
              {cfg.pipeline_name && <p className={styles.configHint}>Pipeline atual: <strong>{cfg.pipeline_name}</strong> (ID: {cfg.pipeline_id})</p>}
              <button className="btn btn-ghost" onClick={loadPipelines} style={{ marginBottom: '1rem' }}>Carregar Pipelines</button>

              {pipelines.length > 0 && (
                <>
                  <div className={styles.pipelineList}>
                    {pipelines.map(p => (
                      <button key={p.id} className={`${styles.pipelineBtn} ${selectedPipeline?.id === p.id ? styles.pipelineActive : ''}`} onClick={() => selectPipeline(p)}>
                        {p.name}
                      </button>
                    ))}
                  </div>

                  {selectedPipeline && (
                    <div className={styles.stageMapping}>
                      <h4>Mapear Stages: {selectedPipeline.name}</h4>
                      {['stage_new_lead', 'stage_responded', 'stage_interested', 'stage_won', 'stage_lost'].map(key => (
                        <div key={key} className={styles.stageRow}>
                          <label className={styles.stageLabel}>
                            {key === 'stage_new_lead' ? 'Lead Novo (entrada)' :
                             key === 'stage_responded' ? 'Respondido (1o contato)' :
                             key === 'stage_interested' ? 'Interesse (conversao)' :
                             key === 'stage_won' ? 'Venda Fechada (won)' : 'Perdido (lost)'}
                          </label>
                          <select value={stageMap[key]} onChange={e => setStageMap(p => ({ ...p, [key]: parseInt(e.target.value) || '' }))}>
                            <option value="">-- Selecione --</option>
                            {selectedPipeline.statuses?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      ))}
                      <button className="btn btn-primary" onClick={savePipelineConfig} style={{ marginTop: '1rem' }}>Salvar Mapeamento</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {configTab === 'users' && (
        <div className={styles.configSection}>
          <h3 className={styles.configSubtitle}>Mapear Users Kommo para Vendedoras</h3>
          <p className={styles.configDesc}>
            Associe cada usuario do Kommo a uma vendedora do sistema para que as metricas sejam atribuidas corretamente.
          </p>
          {!cfg?.connected ? (
            <p className={styles.configWarn}>Conecte o Kommo primeiro.</p>
          ) : (
            <>
              <div className={styles.modalBtns} style={{ marginBottom: '1rem' }}>
                <button className="btn btn-ghost" onClick={loadKommoUsers}>Carregar Users</button>
                <button className="btn btn-primary" onClick={handleAutoMap}>Auto-mapear por Email</button>
              </div>

              {kommoUsers.length > 0 && (
                <div className={styles.sellersManageTable}>
                  <div className={styles.mHead} style={{ gridTemplateColumns: '0.5fr 1.5fr 2fr 2fr' }}>
                    <span>ID</span><span>Nome Kommo</span><span>Email</span><span>Vendedora</span>
                  </div>
                  {kommoUsers.map(ku => {
                    const mapped = userMap.find(m => m.kommo_user_id === ku.id);
                    return (
                      <div key={ku.id} className={styles.mRow} style={{ gridTemplateColumns: '0.5fr 1.5fr 2fr 2fr' }}>
                        <span>{ku.id}</span>
                        <span className={styles.mName}>{ku.name}</span>
                        <span className={styles.mEmail}>{ku.email || '--'}</span>
                        <span>
                          <select value={mapped?.seller_id || ''} onChange={e => handleMapUser(ku.id, parseInt(e.target.value) || null)} style={{ width: '100%' }}>
                            <option value="">-- Nao mapeado --</option>
                            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {kommoUsers.length === 0 && userMap.length > 0 && (
                <div className={styles.sellersManageTable}>
                  <div className={styles.mHead} style={{ gridTemplateColumns: '0.5fr 1.5fr 2fr 2fr' }}>
                    <span>ID</span><span>Nome Kommo</span><span>Email</span><span>Vendedora</span>
                  </div>
                  {userMap.map(m => (
                    <div key={m.id} className={styles.mRow} style={{ gridTemplateColumns: '0.5fr 1.5fr 2fr 2fr' }}>
                      <span>{m.kommo_user_id}</span>
                      <span>{m.kommo_user_name || '--'}</span>
                      <span className={styles.mEmail}>{m.kommo_user_email || '--'}</span>
                      <span>
                        <select value={m.seller_id || ''} onChange={e => handleMapUser(m.kommo_user_id, parseInt(e.target.value) || null)} style={{ width: '100%' }}>
                          <option value="">-- Nao mapeado --</option>
                          {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SYNC ── */}
      {configTab === 'sync' && (
        <div className={styles.configSection}>
          <h3 className={styles.configSubtitle}>Sincronizacao com Kommo</h3>
          <p className={styles.configDesc}>
            Execute um sync manual para puxar leads do dia e gerar relatorios automaticamente. O sync automatico roda a cada {cfg?.sync_interval_minutes || 15} minutos.
          </p>
          {cfg?.last_sync_at && <p className={styles.configHint}>Ultimo sync: {fmtDt(cfg.last_sync_at)}</p>}

          <div className={styles.ffRow} style={{ marginBottom: '1rem', alignItems: 'flex-end' }}>
            <div className={styles.ff}><label>Data para sync</label><input type="date" value={syncDate} onChange={e => setSyncDate(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleSync} disabled={syncing || !cfg?.connected}>
              {syncing ? 'Sincronizando...' : 'Executar Sync'}
            </button>
          </div>

          {syncLogs.length > 0 && (
            <>
              <h4 style={{ marginBottom: '0.6rem', fontSize: '0.85rem' }}>Historico de Sync</h4>
              <div className={styles.sellersManageTable}>
                <div className={styles.mHead} style={{ gridTemplateColumns: '1fr 0.8fr 0.8fr 0.8fr 2fr 1.2fr' }}>
                  <span>Tipo</span><span>Status</span><span>Leads</span><span>Relatorios</span><span>Erro</span><span>Data</span>
                </div>
                {syncLogs.map(l => (
                  <div key={l.id} className={styles.mRow} style={{ gridTemplateColumns: '1fr 0.8fr 0.8fr 0.8fr 2fr 1.2fr' }}>
                    <span>{l.sync_type}</span>
                    <span className={l.status === 'success' ? styles.statusOn : l.status === 'error' ? styles.statusOff : ''}>{l.status}</span>
                    <span>{l.leads_processed}</span>
                    <span>{l.reports_created}</span>
                    <span className={styles.mEmail}>{l.error_message || '--'}</span>
                    <span className={styles.mEmail}>{fmtDt(l.started_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WEBHOOK MONITOR ── */}
      {configTab === 'webhook' && (
        <div className={styles.configSection}>
          <h3 className={styles.configSubtitle}>Monitoramento de Webhook</h3>
          <p className={styles.configDesc}>
            URL do webhook: <code style={{ background: 'var(--bg-primary)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.82rem' }}>https://demandas.sortehub.online/api/kommo/webhook</code>
          </p>
          <p className={styles.configHint}>
            Configure este URL nas webhooks da integracao Kommo. Eventos processados atualizam relatorios em tempo real.
          </p>

          {webhookStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.8rem', margin: '1.2rem 0' }}>
              {[
                { label: 'Total Eventos', value: webhookStats.total_events, color: 'var(--accent-purple)' },
                { label: 'Processados', value: webhookStats.processed, color: '#00b894' },
                { label: 'Pendentes', value: webhookStats.pending, color: webhookStats.pending > 0 ? '#e17055' : 'var(--text-muted)' },
                { label: 'Ultima Hora', value: webhookStats.last_hour, color: 'var(--accent-blue, #5b8def)' },
                { label: 'Ultimas 24h', value: webhookStats.last_24h, color: 'var(--accent-blue, #5b8def)' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '0.8rem 1rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {webhookStats?.last_event_at && (
            <p className={styles.configHint} style={{ marginBottom: '1rem' }}>
              Ultimo evento recebido: {fmtDt(webhookStats.last_event_at)}
            </p>
          )}

          {webhookStats?.by_type?.length > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Eventos por Tipo (24h)</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {webhookStats.by_type.map((t, i) => (
                  <span key={i} style={{
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: '20px', padding: '0.3rem 0.8rem', fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                  }}>
                    {t.event_type.replace('_', ' ')}: <strong style={{ color: 'var(--accent-purple)' }}>{t.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {webhookStats?.recent_errors?.length > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#e17055' }}>Erros Recentes</h4>
              {webhookStats.recent_errors.map((e, i) => (
                <div key={i} style={{
                  background: 'rgba(225,112,85,0.08)', border: '1px solid rgba(225,112,85,0.2)',
                  borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.8rem', marginBottom: '0.4rem',
                  fontSize: '0.78rem', color: 'var(--text-secondary)',
                }}>
                  <strong>{e.event_type}</strong> - {e.error_message} <span style={{ color: 'var(--text-muted)' }}>({fmtDt(e.created_at)})</span>
                </div>
              ))}
            </div>
          )}

          {webhookEvents.length > 0 && (
            <>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ultimos Eventos</h4>
              <div className={styles.sellersManageTable}>
                <div className={styles.mHead} style={{ gridTemplateColumns: '0.5fr 1fr 0.8fr 1.2fr' }}>
                  <span>ID</span><span>Tipo</span><span>Status</span><span>Data</span>
                </div>
                {webhookEvents.map(ev => (
                  <div key={ev.id} className={styles.mRow} style={{ gridTemplateColumns: '0.5fr 1fr 0.8fr 1.2fr' }}>
                    <span>#{ev.id}</span>
                    <span>{ev.event_type.replace('_', ' ')}</span>
                    <span className={ev.processed ? styles.statusOn : styles.statusOff}>{ev.processed ? 'OK' : 'Pendente'}</span>
                    <span className={styles.mEmail}>{fmtDt(ev.created_at)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-ghost" onClick={loadWebhookData}>Atualizar</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function SalesDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState('dashboard');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('');
  const [stats, setStats] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [monthly, setMonthly] = useState(null);
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(null);
  const [newSeller, setNewSeller] = useState({ name: '', email: '', password: '123456', shift: 'completo', goal_leads: 0, goal_sales: 0, goal_revenue: 0 });
  const [goalForm, setGoalForm] = useState({ goal_leads: 0, goal_sales: 0, goal_revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [kommoStats, setKommoStats] = useState(null);
  // Relatorios individuais
  const [sellerDetail, setSellerDetail] = useState(null);
  const [sellerDetailLoading, setSellerDetailLoading] = useState(false);
  const [detailMonth, setDetailMonth] = useState(new Date().getMonth() + 1);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());

  const loadStats = useCallback(async () => {
    try {
      const params = { date };
      if (shift) params.shift = shift;
      const data = await sales.stats(params);
      setStats(data);
    } catch {}
  }, [date, shift]);

  const loadSellers = useCallback(async () => {
    try { setSellers(await sales.sellers()); } catch {}
  }, []);

  const loadMonthly = useCallback(async () => {
    try { setMonthly(await sales.monthlySummary({ month: monthFilter, year: yearFilter })); } catch {}
  }, [monthFilter, yearFilter]);

  const loadKommoStats = useCallback(async () => {
    try { setKommoStats(await kommo.getWebhookStats()); } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadSellers(), loadKommoStats()]).finally(() => setLoading(false));
    const interval = setInterval(() => { loadStats(); loadKommoStats(); }, 60000);
    return () => clearInterval(interval);
  }, [loadStats, loadSellers, loadKommoStats]);

  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  const handleAddSeller = async (e) => {
    e.preventDefault();
    try {
      await sales.createSeller(newSeller);
      setShowAddModal(false);
      setNewSeller({ name: '', email: '', password: '123456', shift: 'completo', goal_leads: 0, goal_sales: 0, goal_revenue: 0 });
      loadSellers(); loadStats();
    } catch (err) { alert(err.message); }
  };

  const openSellerReports = async (sellerId, month, year) => {
    setSellerDetailLoading(true);
    try {
      const m = month || detailMonth;
      const y = year || detailYear;
      const data = await sales.sellerReports(sellerId, { month: m, year: y });
      setSellerDetail(data);
      setDetailMonth(m);
      setDetailYear(y);
      setPage('detalhe-vendedora');
    } catch (err) { alert(err.message); }
    finally { setSellerDetailLoading(false); }
  };

  const refreshSellerDetail = async (month, year) => {
    if (!sellerDetail?.seller?.id) return;
    openSellerReports(sellerDetail.seller.id, month, year);
  };

  const handleToggleSeller = async (id) => { await sales.toggleSeller(id); loadSellers(); };
  const handleRemoveSeller = async (id) => {
    if (!confirm('Desativar esta vendedora?')) return;
    await sales.removeSeller(id); loadSellers(); loadStats();
  };

  const handleUpdateGoals = async (e) => {
    e.preventDefault();
    try {
      await sales.updateGoals(showGoalModal, goalForm);
      setShowGoalModal(null); loadSellers();
    } catch (err) { alert(err.message); }
  };

  const openGoalModal = (seller) => {
    setGoalForm({ goal_leads: seller.monthly_goal_leads || 0, goal_sales: seller.monthly_goal_sales || 0, goal_revenue: seller.monthly_goal_revenue || 0 });
    setShowGoalModal(seller.id);
  };

  const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d) => {
    if (!d) return '--';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const fmtShort = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '--';

  const handleLogout = () => { logout(); navigate('/login'); };

  if (loading) return <div className={styles.loadWrap}><div className={styles.spinner} /><p>Carregando painel...</p></div>;

  const ranking = stats?.daily ? [...stats.daily].sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue)) : [];
  const daily = stats?.daily || [];
  const totals = stats?.totals || {};
  const ticketMedio = (totals.total_sales > 0) ? (parseFloat(totals.total_revenue) / parseInt(totals.total_sales)) : 0;

  const todayStr = fmtDate(date);

  return (
    <div className={styles.layout}>
      {/* ─── SIDEBAR ─── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <span className={styles.brandIcon}>S</span>
          <div>
            <div className={styles.brandName}>PAINEL SARA</div>
            <div className={styles.brandSub}>Gestao de Vendedoras</div>
          </div>
        </div>
        <nav className={styles.sidebarNav}>
          <button className={`${styles.sideNavBtn} ${page === 'dashboard' ? styles.sideNavActive : ''}`} onClick={() => setPage('dashboard')}>
            <span className={styles.navIcon}>&#9632;</span> Dashboard
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'vendedoras' ? styles.sideNavActive : ''}`} onClick={() => setPage('vendedoras')}>
            <span className={styles.navIcon}>&#9679;</span> Vendedoras
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'ranking' ? styles.sideNavActive : ''}`} onClick={() => setPage('ranking')}>
            <span className={styles.navIcon}>&#9733;</span> Ranking
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'relatorios' ? styles.sideNavActive : ''}`} onClick={() => setPage('relatorios')}>
            <span className={styles.navIcon}>&#9776;</span> Relatorios
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'chat' ? styles.sideNavActive : ''}`} onClick={() => setPage('chat')}>
            <span className={styles.navIcon}>&#9993;</span> Chat
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'conhecimento' ? styles.sideNavActive : ''}`} onClick={() => setPage('conhecimento')}>
            <span className={styles.navIcon}>&#9733;</span> Conhecimento
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'config' ? styles.sideNavActive : ''}`} onClick={() => setPage('config')}>
            <span className={styles.navIcon}>&#9881;</span> Configuracoes
          </button>
          <button className={`${styles.sideNavBtn} ${page === 'aparencia' ? styles.sideNavActive : ''}`} onClick={() => setPage('aparencia')}>
            <span className={styles.navIcon}>&#9790;</span> Aparencia
          </button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser}>
            <span className={styles.sidebarAvatar}>S</span>
            <div>
              <div className={styles.sidebarUserName}>{user.name}</div>
              <div className={styles.sidebarUserRole}>Sales Admin</div>
            </div>
          </div>
          <button onClick={handleLogout} className={styles.sideLogout}>Sair</button>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main className={styles.main}>
        {/* ══ DASHBOARD ══ */}
        {page === 'dashboard' && (
          <>
            <div className={styles.topBar}>
              <h1 className={styles.pageTitle}>Dashboard Vendas</h1>
              <div className={styles.dateInput}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            {/* Alertas de Performance */}
            {stats?.alerts?.length > 0 && (
              <div className={styles.alertBar}>
                {stats.alerts.map((a, i) => {
                  // Suporta formato antigo (string) e novo (objeto com type/msg)
                  const alertObj = typeof a === 'string' ? { type: 'warning', msg: a } : a;
                  return (
                    <div key={i} className={`${styles.alertItem} ${alertObj.type === 'danger' ? styles.alertDanger : alertObj.type === 'success' ? styles.alertSuccess : ''}`}>
                      <span className={`${styles.alertDot} ${alertObj.type === 'danger' ? styles.alertDotDanger : alertObj.type === 'success' ? styles.alertDotSuccess : ''}`}>
                        {alertObj.type === 'success' ? '\u2713' : '!'}
                      </span>
                      <span>{alertObj.msg}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cards totais */}
            <div className={styles.statsCards}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>LEADS DO TRAFEGO</span>
                <span className={styles.statNum}>{totals.total_leads || 0}</span>
                <span className={styles.statSub}>Via trafego pago</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>LEADS RESPONDIDOS</span>
                <span className={styles.statNum}>{daily.reduce((s, d) => s + (d.leads_responded || 0), 0)}</span>
                <span className={styles.statSub}>Primeiro contato feito</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>CONVERSOES</span>
                <span className={styles.statNum}>{daily.reduce((s, d) => s + (d.conversions || 0), 0)}</span>
                <span className={styles.statSub}>Demonstraram interesse</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>VENDAS FECHADAS</span>
                <span className={`${styles.statNum} ${styles.greenNum}`}>{totals.total_sales || 0}</span>
                <span className={styles.statSub}>Compra confirmada</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>TICKET MEDIO</span>
                <span className={`${styles.statNum} ${styles.greenNum}`}>{fmt(ticketMedio)}</span>
                <span className={styles.statSub}>Valor por venda</span>
              </div>
            </div>

            {/* Kommo Status */}
            {kommoStats && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap',
                padding: '0.8rem 1.2rem', marginBottom: '1rem',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: '0.78rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: kommoStats.last_hour > 0 ? '#00b894' : kommoStats.last_24h > 0 ? '#fdcb6e' : '#e17055',
                    display: 'inline-block',
                  }} />
                  <strong style={{ color: 'var(--text-primary)' }}>Kommo CRM</strong>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>
                  Webhooks 24h: <strong style={{ color: 'var(--accent-purple)' }}>{kommoStats.last_24h}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Ultima hora: <strong style={{ color: 'var(--text-primary)' }}>{kommoStats.last_hour}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Total processados: <strong style={{ color: '#00b894' }}>{kommoStats.processed}</strong>
                </span>
                {kommoStats.pending > 0 && (
                  <span style={{ color: '#e17055' }}>
                    Pendentes: <strong>{kommoStats.pending}</strong>
                  </span>
                )}
                {kommoStats.last_event_at && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.72rem' }}>
                    Ultimo evento: {new Date(kommoStats.last_event_at).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
            )}

            {/* Tabs turno */}
            <div className={styles.shiftTabs}>
              <button className={`${styles.shiftTab} ${shift === '' ? styles.shiftActive : ''}`} onClick={() => setShift('')}>Todos</button>
              <button className={`${styles.shiftTab} ${styles.shiftManha} ${shift === 'manha' ? styles.shiftActive : ''}`} onClick={() => setShift('manha')}>Manha (09h-14h)</button>
              <button className={`${styles.shiftTab} ${shift === 'completo' ? styles.shiftActive : ''}`} onClick={() => setShift('completo')}>Dia Completo (09h-18h)</button>
            </div>

            {/* Tabela vendedoras */}
            <div className={styles.sellersTable}>
              <div className={styles.tHead}>
                <span></span>
                <span>LEADS RECEB.</span>
                <span>RESPONDIDOS</span>
                <span>CONVERSOES</span>
                <span>VENDAS</span>
                <span>FATURAMENTO</span>
                <span>TAXA CONV.</span>
                <span></span>
              </div>
              {daily.map((s, i) => (
                <div key={s.seller_id} className={styles.tRow}>
                  <span className={styles.tSeller} onClick={() => openSellerReports(s.seller_id)} style={{ cursor: 'pointer' }} title="Ver relatorios">
                    <span className={styles.sellerDot} style={{ background: SELLER_COLORS[i % SELLER_COLORS.length] }}>
                      {s.name?.charAt(0)}
                    </span>
                    <span className={styles.sellerNameCell} style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}>{s.name}</span>
                  </span>
                  <span>{s.leads_received}</span>
                  <span>{s.leads_responded}</span>
                  <span>{s.conversions}</span>
                  <span className={styles.greenCell}>{s.sales_closed}</span>
                  <span className={styles.greenCell}>{fmt(s.revenue)}</span>
                  <span className={styles.convCell}>
                    <span>{s.conversion_rate}%</span>
                    <div className={styles.miniBar}><div className={styles.miniFill} style={{ width: `${Math.min(s.conversion_rate, 100)}%`, background: s.conversion_rate >= 25 ? 'var(--accent-green)' : s.conversion_rate >= 15 ? 'var(--priority-media)' : 'var(--priority-urgente)' }} /></div>
                  </span>
                  <span></span>
                </div>
              ))}
              {daily.length === 0 && <div className={styles.emptyRow}>Nenhum dado para esta data.</div>}
            </div>

            {/* Ranking do dia */}
            <h2 className={styles.secTitle}>Ranking do Dia</h2>
            <div className={styles.rankingRow}>
              {ranking.slice(0, 5).map((s, i) => (
                <div key={s.seller_id} className={`${styles.rankCard} ${i === 0 ? styles.rank1 : i === 1 ? styles.rank2 : i === 2 ? styles.rank3 : ''}`}>
                  <div className={styles.rankPos}>{i + 1}</div>
                  <div className={styles.rankDot} style={{ background: SELLER_COLORS[ranking.indexOf(s) % SELLER_COLORS.length] }}>{s.name?.charAt(0)}</div>
                  <div className={styles.rankName}>{s.name}</div>
                  <div className={styles.rankRev}>{fmt(s.revenue)}</div>
                </div>
              ))}
            </div>

            {/* Resumo Mensal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 className={styles.secTitle} style={{ margin: 0 }}>Resumo Mensal - {MONTHS[monthFilter - 1]} {yearFilter}</h2>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => monthly && generateSalesPDF({ sellers: monthly.sellers, totals: monthly.totals, month: monthFilter, year: yearFilter, daily: stats?.daily })}>
                  Exportar PDF
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => monthly && generateSalesExcel({ sellers: monthly.sellers, totals: monthly.totals, month: monthFilter, year: yearFilter, daily: stats?.daily })}>
                  Exportar Excel
                </button>
              </div>
            </div>
            <div className={styles.monthFilters}>
              <select value={monthFilter} onChange={e => setMonthFilter(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {monthly && (
              <div className={styles.monthGrid}>
                <div className={styles.monthBox}>
                  <h4>Totais do Mes</h4>
                  <div className={styles.monthStat}><span>Total de Leads</span><span className={styles.monthVal}>{monthly.totals?.total_leads || 0}</span></div>
                  <div className={styles.monthStat}><span>Leads Respondidos</span><span className={styles.monthVal}>{monthly.totals?.total_responded || 0}</span></div>
                  <div className={styles.monthStat}><span>Conversoes</span><span className={styles.monthVal}>{monthly.totals?.total_conversions || 0}</span></div>
                  <div className={styles.monthStat}><span>Vendas Fechadas</span><span className={`${styles.monthVal} ${styles.greenNum}`}>{monthly.totals?.total_sales || 0}</span></div>
                  <div className={styles.monthStat}><span>Faturamento Total</span><span className={`${styles.monthVal} ${styles.greenNum}`}>{fmt(monthly.totals?.total_revenue)}</span></div>
                </div>
                <div className={styles.monthBox}>
                  <h4>Por Vendedora Mensal</h4>
                  {monthly.sellers?.map((s, i) => (
                    <div key={s.seller_id} className={styles.monthSeller}>
                      <span className={styles.monthSellerDot} style={{ background: SELLER_COLORS[i % SELLER_COLORS.length] }}>{s.name?.charAt(0)}</span>
                      <span className={styles.monthSellerName}>{s.name}</span>
                      <span className={styles.monthSellerNum}>{s.sales_closed} vendas</span>
                      <span className={styles.monthSellerRev}>{fmt(s.revenue)}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.monthBox}>
                  <h4>Metricas de Qualidade</h4>
                  {(() => {
                    const t = monthly.totals || {};
                    const respRate = t.total_leads > 0 ? ((t.total_responded / t.total_leads) * 100).toFixed(1) : '0.0';
                    const convRate = t.total_leads > 0 ? ((t.total_sales / t.total_leads) * 100).toFixed(1) : '0.0';
                    const ticket = t.total_sales > 0 ? (parseFloat(t.total_revenue) / t.total_sales) : 0;
                    return (
                      <>
                        <div className={styles.monthStat}><span>Taxa de Resposta Media</span><span className={styles.monthVal}>{respRate}%</span></div>
                        <div className={styles.monthStat}><span>Taxa de Conversao Media</span><span className={styles.monthVal}>{convRate}%</span></div>
                        <div className={styles.monthStat}><span>Ticket Medio</span><span className={styles.monthVal}>{fmt(ticket)}</span></div>
                        <div className={styles.monthStat}><span>Vendedoras Pendentes</span><span className={styles.monthVal}>{stats?.alerts?.length || 0}</span></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ VENDEDORAS ══ */}
        {page === 'vendedoras' && (
          <>
            <div className={styles.topBar}>
              <h1 className={styles.pageTitle}>Gerenciar Vendedoras ({sellers.length})</h1>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Adicionar Vendedora</button>
            </div>
            <div className={styles.sellersManageTable}>
              <div className={styles.mHead}>
                <span>Nome</span><span>Email</span><span>Turno</span><span>Meta Leads</span><span>Meta Vendas</span><span>Meta Faturamento</span><span>Status</span><span>Acoes</span>
              </div>
              {sellers.map((s, i) => (
                <div key={s.id} className={styles.mRow}>
                  <span className={styles.mName}>
                    <span className={styles.sellerDot} style={{ background: SELLER_COLORS[i % SELLER_COLORS.length] }}>{s.name?.charAt(0)}</span>
                    {s.name}
                  </span>
                  <span className={styles.mEmail}>{s.email}</span>
                  <span className={styles.mShift}>{s.shift === 'manha' ? 'Manha' : 'Completo'}</span>
                  <span>{s.monthly_goal_leads || 0}</span>
                  <span>{s.monthly_goal_sales || 0}</span>
                  <span>{fmt(s.monthly_goal_revenue)}</span>
                  <span className={s.active ? styles.statusOn : styles.statusOff}>{s.active ? 'Ativa' : 'Inativa'}</span>
                  <span className={styles.mActions}>
                    <button className="btn btn-primary btn-sm" onClick={() => openSellerReports(s.id)}>Relatorios</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openGoalModal(s)}>Metas</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggleSeller(s.id)}>{s.active ? 'Desativar' : 'Ativar'}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveSeller(s.id)}>Remover</button>
                  </span>
                </div>
              ))}
              {sellers.length === 0 && <div className={styles.emptyRow}>Nenhuma vendedora cadastrada.</div>}
            </div>
          </>
        )}

        {/* ══ RANKING ══ */}
        {page === 'ranking' && (
          <>
            <div className={styles.topBar}>
              <h1 className={styles.pageTitle}>Ranking</h1>
              <div className={styles.dateInput}><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            </div>
            <div className={styles.rankingFull}>
              {ranking.map((s, i) => (
                <div key={s.seller_id} className={`${styles.rankFull} ${i === 0 ? styles.rankF1 : i === 1 ? styles.rankF2 : i === 2 ? styles.rankF3 : ''}`} onClick={() => openSellerReports(s.seller_id)} style={{ cursor: 'pointer' }}>
                  <div className={styles.rankFPos}>{i + 1}</div>
                  <div className={styles.rankFDot} style={{ background: SELLER_COLORS[ranking.indexOf(s) % SELLER_COLORS.length] }}>{s.name?.charAt(0)}</div>
                  <div className={styles.rankFInfo}>
                    <span className={styles.rankFName}>{s.name}</span>
                    <span className={styles.rankFMeta}>{s.sales_closed} vendas | {s.leads_received} leads | {s.conversion_rate}% conversao</span>
                  </div>
                  <div className={styles.rankFRev}>{fmt(s.revenue)}</div>
                </div>
              ))}
              {ranking.length === 0 && <div className={styles.emptyRow}>Nenhum dado.</div>}
            </div>
          </>
        )}

        {/* ══ RELATORIOS ══ */}
        {page === 'relatorios' && (
          <>
            <div className={styles.topBar}>
              <h1 className={styles.pageTitle}>Relatorios Mensal</h1>
              <div className={styles.monthFiltersInline}>
                <select value={monthFilter} onChange={e => setMonthFilter(parseInt(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => monthly && generateSalesPDF({ sellers: monthly.sellers, totals: monthly.totals, month: monthFilter, year: yearFilter, daily: stats?.daily })}>
                  PDF
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => monthly && generateSalesExcel({ sellers: monthly.sellers, totals: monthly.totals, month: monthFilter, year: yearFilter, daily: stats?.daily })}>
                  Excel
                </button>
              </div>
            </div>
            {monthly && (
              <div className={styles.reportTable}>
                <div className={styles.rpHead}>
                  <span>Vendedora</span><span>Leads</span><span>Respondidos</span><span>Conversoes</span><span>Vendas</span><span>Faturamento</span><span>Conversao</span><span>Dias</span>
                </div>
                {monthly.sellers?.map((s, i) => (
                  <div key={s.seller_id} className={styles.rpRow}>
                    <span className={styles.tSeller} onClick={() => openSellerReports(s.seller_id, monthFilter, yearFilter)} style={{ cursor: 'pointer' }} title="Ver relatorios">
                      <span className={styles.sellerDot} style={{ background: SELLER_COLORS[i % SELLER_COLORS.length] }}>{s.name?.charAt(0)}</span>
                      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}>{s.name}</span>
                    </span>
                    <span>{s.leads_received}</span>
                    <span>{s.leads_responded}</span>
                    <span>{s.conversions}</span>
                    <span className={styles.greenCell}>{s.sales_closed}</span>
                    <span className={styles.greenCell}>{fmt(s.revenue)}</span>
                    <span>{s.conversion_rate}%</span>
                    <span>{s.days_reported}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ DETALHE VENDEDORA ══ */}
        {page === 'detalhe-vendedora' && (
          <>
            <div className={styles.topBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage('vendedoras')} style={{ fontSize: '1.1rem', padding: '0.2rem 0.6rem' }}>&larr;</button>
                <div>
                  <h1 className={styles.pageTitle} style={{ marginBottom: '0.15rem' }}>
                    {sellerDetail?.seller?.name || 'Vendedora'}
                  </h1>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {sellerDetail?.seller?.email} &middot; Turno: {sellerDetail?.seller?.shift === 'manha' ? 'Manha' : 'Completo'}
                  </span>
                </div>
              </div>
              <div className={styles.monthFiltersInline}>
                <select value={detailMonth} onChange={e => { const m = parseInt(e.target.value); setDetailMonth(m); refreshSellerDetail(m, detailYear); }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={detailYear} onChange={e => { const y = parseInt(e.target.value); setDetailYear(y); refreshSellerDetail(detailMonth, y); }}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => sellerDetail && generateSellerPDF({ ...sellerDetail, month: detailMonth, year: detailYear })}>
                  PDF
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => sellerDetail && generateSellerExcel({ ...sellerDetail, month: detailMonth, year: detailYear })}>
                  Excel
                </button>
              </div>
            </div>

            {sellerDetailLoading && <div className={styles.emptyRow}>Carregando...</div>}

            {!sellerDetailLoading && sellerDetail && (
              <>
                {/* Resumo do mes */}
                <div className={styles.statsCards}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>LEADS RECEBIDOS</span>
                    <span className={styles.statNum}>{sellerDetail.totals?.total_leads || 0}</span>
                    <span className={styles.statSub}>no mes</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>RESPONDIDOS</span>
                    <span className={styles.statNum}>{sellerDetail.totals?.total_responded || 0}</span>
                    <span className={styles.statSub}>
                      {(sellerDetail.totals?.total_leads > 0
                        ? ((sellerDetail.totals.total_responded / sellerDetail.totals.total_leads) * 100).toFixed(1)
                        : '0.0')}% taxa
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>CONVERSOES</span>
                    <span className={styles.statNum}>{sellerDetail.totals?.total_conversions || 0}</span>
                    <span className={styles.statSub}>interesse real</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>VENDAS FECHADAS</span>
                    <span className={`${styles.statNum} ${styles.greenNum}`}>{sellerDetail.totals?.total_sales || 0}</span>
                    <span className={styles.statSub}>
                      Meta: {sellerDetail.seller?.monthly_goal_sales || 0}
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>FATURAMENTO</span>
                    <span className={`${styles.statNum} ${styles.greenNum}`}>{fmt(sellerDetail.totals?.total_revenue)}</span>
                    <span className={styles.statSub}>
                      Meta: {fmt(sellerDetail.seller?.monthly_goal_revenue)}
                    </span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>DIAS REPORTADOS</span>
                    <span className={styles.statNum}>{sellerDetail.totals?.days_reported || 0}</span>
                    <span className={styles.statSub}>relatorios enviados</span>
                  </div>
                </div>

                {/* Barra de progresso das metas */}
                {(() => {
                  const goalSales = sellerDetail.seller?.monthly_goal_sales || 0;
                  const goalRevenue = parseFloat(sellerDetail.seller?.monthly_goal_revenue) || 0;
                  const actualSales = sellerDetail.totals?.total_sales || 0;
                  const actualRevenue = parseFloat(sellerDetail.totals?.total_revenue) || 0;
                  const salesPct = goalSales > 0 ? Math.min((actualSales / goalSales) * 100, 100) : 0;
                  const revPct = goalRevenue > 0 ? Math.min((actualRevenue / goalRevenue) * 100, 100) : 0;
                  const convRate = (sellerDetail.totals?.total_leads > 0)
                    ? ((actualSales / sellerDetail.totals.total_leads) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.2rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Vendas</span>
                            <span>{actualSales} / {goalSales}</span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${salesPct}%`, height: '100%', background: '#e17055', borderRadius: '4px', transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{salesPct.toFixed(1)}% da meta</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Faturamento</span>
                            <span>{fmt(actualRevenue)} / {fmt(goalRevenue)}</span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${revPct}%`, height: '100%', background: 'var(--accent-green)', borderRadius: '4px', transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{revPct.toFixed(1)}% da meta</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Conversao</span>
                            <span>{convRate}%</span>
                          </div>
                          <div style={{ height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(parseFloat(convRate) * 4, 100)}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: '4px', transition: 'width 0.4s' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Meta: 25%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Lista de relatorios */}
                <h2 className={styles.secTitle}>Relatorios - {MONTHS[detailMonth - 1]} {detailYear}</h2>
                <div className={styles.reportTable}>
                  <div className={styles.rpHead} style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr 1fr 2fr' }}>
                    <span>DATA</span><span>TURNO</span><span>LEADS</span><span>RESPOND.</span><span>CONV.</span><span>VENDAS</span><span>FATURAMENTO</span><span>TICKET</span><span>OBSERVACOES</span>
                  </div>
                  {sellerDetail.reports?.map(r => {
                    const ticket = r.sales_closed > 0 ? (parseFloat(r.revenue) / r.sales_closed) : 0;
                    const convRate = r.leads_received > 0 ? ((r.sales_closed / r.leads_received) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={r.id} className={styles.rpRow} style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr 1fr 2fr' }}>
                        <span style={{ fontWeight: 600 }}>{r.report_date ? new Date(r.report_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '--'}</span>
                        <span style={{ color: r.report_type === 'manha' ? '#fdcb6e' : 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.75rem' }}>
                          {r.report_type === 'manha' ? 'MANHA (09-14h)' : 'COMPLETO (09-18h)'}
                        </span>
                        <span>{r.leads_received}</span>
                        <span>{r.leads_responded}</span>
                        <span>{r.conversions}</span>
                        <span className={styles.greenCell}>{r.sales_closed}</span>
                        <span className={styles.greenCell}>{fmt(r.revenue)}</span>
                        <span>{fmt(ticket)}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes || ''}>
                          {r.notes || '--'}
                        </span>
                      </div>
                    );
                  })}
                  {(!sellerDetail.reports || sellerDetail.reports.length === 0) && (
                    <div className={styles.emptyRow}>Nenhum relatorio neste periodo.</div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ══ CHAT ══ */}
        {page === 'chat' && <SalesChat />}

        {/* ══ CONHECIMENTO ══ */}
        {page === 'conhecimento' && <KnowledgeBase />}

        {/* ══ CONFIG ══ */}
        {page === 'config' && <KommoConfig sellers={sellers} />}

        {/* ══ APARENCIA ══ */}
        {page === 'aparencia' && (
          <>
            <div className={styles.topBar}>
              <h1 className={styles.pageTitle}>Aparencia</h1>
            </div>
            <div className={styles.configSection}>
              <ThemeSettings />
            </div>
          </>
        )}
      </main>

      {/* ─── MODAL: ADICIONAR ─── */}
      {showAddModal && (
        <div className={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Adicionar Vendedora</h3>
            <form onSubmit={handleAddSeller}>
              <div className={styles.ff}><label>Nome</label><input type="text" value={newSeller.name} onChange={e => setNewSeller(p => ({ ...p, name: e.target.value }))} required /></div>
              <div className={styles.ff}><label>Email</label><input type="email" value={newSeller.email} onChange={e => setNewSeller(p => ({ ...p, email: e.target.value }))} required /></div>
              <div className={styles.ff}><label>Senha inicial</label><input type="text" value={newSeller.password} onChange={e => setNewSeller(p => ({ ...p, password: e.target.value }))} /></div>
              <div className={styles.ff}><label>Turno</label>
                <select value={newSeller.shift} onChange={e => setNewSeller(p => ({ ...p, shift: e.target.value }))}>
                  <option value="manha">Manha (09h-14h)</option><option value="completo">Completo (09h-18h)</option>
                </select>
              </div>
              <div className={styles.ffRow}>
                <div className={styles.ff}><label>Meta Leads/mes</label><input type="number" value={newSeller.goal_leads} onChange={e => setNewSeller(p => ({ ...p, goal_leads: parseInt(e.target.value) || 0 }))} /></div>
                <div className={styles.ff}><label>Meta Vendas/mes</label><input type="number" value={newSeller.goal_sales} onChange={e => setNewSeller(p => ({ ...p, goal_sales: parseInt(e.target.value) || 0 }))} /></div>
                <div className={styles.ff}><label>Meta Faturamento/mes</label><input type="number" step="0.01" value={newSeller.goal_revenue} onChange={e => setNewSeller(p => ({ ...p, goal_revenue: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div className={styles.modalBtns}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: METAS ─── */}
      {showGoalModal && (
        <div className={styles.overlay} onClick={() => setShowGoalModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Editar Metas</h3>
            <form onSubmit={handleUpdateGoals}>
              <div className={styles.ffRow}>
                <div className={styles.ff}><label>Meta Leads/mes</label><input type="number" value={goalForm.goal_leads} onChange={e => setGoalForm(p => ({ ...p, goal_leads: parseInt(e.target.value) || 0 }))} /></div>
                <div className={styles.ff}><label>Meta Vendas/mes</label><input type="number" value={goalForm.goal_sales} onChange={e => setGoalForm(p => ({ ...p, goal_sales: parseInt(e.target.value) || 0 }))} /></div>
                <div className={styles.ff}><label>Meta Faturamento/mes</label><input type="number" step="0.01" value={goalForm.goal_revenue} onChange={e => setGoalForm(p => ({ ...p, goal_revenue: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div className={styles.modalBtns}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowGoalModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
