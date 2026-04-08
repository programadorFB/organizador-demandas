import { useState, useEffect } from 'react';
import { sales as salesApi } from '../services/api';
import styles from '../styles/SalesAdmin.module.css';

export default function SalesAdminPage() {
  const [stats, setStats] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ date: new Date().toISOString().split('T')[0], shift: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSeller, setNewSeller] = useState({ name: '', email: '', shift: 'completo', goal_revenue: 0 });

  const loadData = async () => {
    try {
      const [sData, selData] = await Promise.all([
        salesApi.stats(filter),
        salesApi.sellers()
      ]);
      setStats(sData);
      setSellers(selData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [filter]);

  const handleAddSeller = async (e) => {
    e.preventDefault();
    await salesApi.createSeller(newSeller);
    setShowAddModal(false);
    setNewSeller({ name: '', email: '', shift: 'completo', goal_revenue: 0 });
    loadData();
  };

  const toggleSeller = async (id) => {
    await salesApi.toggleSeller(id);
    loadData();
  };

  if (loading && !stats) return <div className="p-4">Carregando painel de vendas...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Painel de Vendas — Sara</h1>
          <p>Acompanhamento em tempo real das vendedoras</p>
        </div>
        <div className={styles.headerActions}>
          <input
            type="date"
            value={filter.date}
            onChange={e => setFilter({ ...filter, date: e.target.value })}
            className="input"
          />
          <select
            value={filter.shift}
            onChange={e => setFilter({ ...filter, shift: e.target.value })}
            className="input"
          >
            <option value="">Todos os turnos</option>
            <option value="manha">Manhã (09h-14h)</option>
            <option value="completo">Completo (09h-18h)</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Vendedora</button>
        </div>
      </header>

      {stats?.alerts?.length > 0 && (
        <div className={styles.alerts}>
          {stats.alerts.map((a, i) => (
            <div key={i} className={styles.alertItem}>⚠️ {a}</div>
          ))}
        </div>
      )}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Leads do Dia</span>
          <h2>{stats?.totals?.total_leads || 0}</h2>
        </div>
        <div className={styles.summaryCard}>
          <span>Vendas do Dia</span>
          <h2>{stats?.totals?.total_sales || 0}</h2>
        </div>
        <div className={styles.summaryCard}>
          <span>Faturamento do Dia</span>
          <h2 className={styles.revenue}>R$ {parseFloat(stats?.totals?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
        </div>
      </div>

      <section className={styles.rankingSection}>
        <h3>Ranking do Dia</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vendedora</th>
                <th>Leads</th>
                <th>Resp.</th>
                <th>Conv.</th>
                <th>Vendas</th>
                <th>Faturamento</th>
                <th>Taxa de Conversão</th>
              </tr>
            </thead>
            <tbody>
              {stats?.daily?.map((s, idx) => (
                <tr key={s.seller_id}>
                  <td>
                    <div className={styles.sellerName}>
                      <span className={styles.rankBadge}>{idx + 1}º</span>
                      {s.name}
                    </div>
                  </td>
                  <td>{s.leads_received}</td>
                  <td>{s.leads_responded}</td>
                  <td>{s.conversions}</td>
                  <td>{s.sales_closed}</td>
                  <td className={styles.revenue}>R$ {parseFloat(s.revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${Math.min(100, s.conversion_rate * 5)}%`, backgroundColor: s.conversion_rate > 15 ? '#10b981' : '#f59e0b' }}
                        ></div>
                      </div>
                      <span>{s.conversion_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.monthlySection}>
        <h3>Resumo Mensal & Metas</h3>
        <div className={styles.sellersGrid}>
          {stats?.monthly?.map(m => {
            const seller = sellers.find(s => s.id === m.seller_id);
            const progress = m.monthly_goal_revenue > 0 ? (m.revenue / m.monthly_goal_revenue) * 100 : 0;
            return (
              <div key={m.seller_id} className={styles.sellerGoalCard}>
                <div className={styles.goalHeader}>
                  <strong>{seller?.name}</strong>
                  <span>R$ {parseFloat(m.revenue).toLocaleString('pt-BR')} / R$ {parseFloat(m.monthly_goal_revenue).toLocaleString('pt-BR')}</span>
                </div>
                <div className={styles.progressBarLarge}>
                  <div className={styles.progressFillLarge} style={{ width: `${Math.min(100, progress)}%` }}></div>
                </div>
                <small>{progress.toFixed(1)}% da meta atingida</small>
              </div>
            );
          })}
        </div>
      </section>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Adicionar Vendedora</h2>
            <form onSubmit={handleAddSeller} className={styles.form}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  required
                  value={newSeller.name}
                  onChange={e => setNewSeller({ ...newSeller, name: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={newSeller.email}
                  onChange={e => setNewSeller({ ...newSeller, email: e.target.value })}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Turno Padrão</label>
                <select
                  value={newSeller.shift}
                  onChange={e => setNewSeller({ ...newSeller, shift: e.target.value })}
                  className="input"
                >
                  <option value="manha">Manhã</option>
                  <option value="completo">Completo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Meta de Faturamento Mensal (R$)</label>
                <input
                  type="number"
                  value={newSeller.goal_revenue}
                  onChange={e => setNewSeller({ ...newSeller, goal_revenue: e.target.value })}
                  className="input"
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
