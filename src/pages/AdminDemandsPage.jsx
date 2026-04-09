import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { demands as demandsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/AdminDemands.module.css';

const STATUS_MAP = {
  backlog: { label: 'Backlog', style: 'statusBacklog' },
  sprint_backlog: { label: 'Sprint Backlog', style: 'statusSprintBacklog' },
  em_progresso: { label: 'Em Progresso', style: 'statusEmProgresso' },
  em_revisao: { label: 'Em Revisao', style: 'statusEmRevisao' },
  concluido: { label: 'Concluido', style: 'statusConcluido' },
  cancelado: { label: 'Cancelado', style: 'statusCancelado' },
};

const PRIORITY_MAP = {
  baixa: { label: 'Baixa', style: 'priorityBaixa' },
  media: { label: 'Media', style: 'priorityMedia' },
  alta: { label: 'Alta', style: 'priorityAlta' },
  urgente: { label: 'Urgente', style: 'priorityUrgente' },
};

const CATEGORY_LABELS = {
  feature: 'Feature',
  bug: 'Bug',
  melhoria: 'Melhoria',
  tarefa_tecnica: 'Tarefa Tecnica',
  documentacao: 'Documentacao',
};

export default function AdminDemandsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [demandsList, setDemandsList] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', assigned_to: '' });

  const backPath = user?.role === 'design_admin' ? '/design/board'
    : user?.role === 'sales_admin' ? '/vendas'
    : '/board';

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;
      const [list, adms] = await Promise.all([
        demandsApi.list(params),
        demandsApi.admins(),
      ]);
      setDemandsList(list);
      setAdmins(adms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleRedirect = async (demandId, adminId) => {
    try {
      await demandsApi.redirect(demandId, adminId ? parseInt(adminId) : null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFilter = (key) => (e) => {
    setFilters(prev => ({ ...prev, [key]: e.target.value }));
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.backBtn} onClick={() => navigate(backPath)}>Voltar</button>
          <h1 className={styles.pageTitle}>Central de Demandas</h1>
          <div className={styles.statsRow}>
            <span className={styles.statBadge}>{demandsList.length} demandas</span>
          </div>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.statBadge}>Logado: {user?.name}</span>
          <button className={styles.backBtn} onClick={load}>Atualizar</button>
        </div>
      </div>

      <div className={styles.filters}>
        <select value={filters.status} onChange={handleFilter('status')}>
          <option value="">Todos Status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={handleFilter('priority')}>
          <option value="">Todas Prioridades</option>
          {Object.entries(PRIORITY_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filters.assigned_to} onChange={handleFilter('assigned_to')}>
          <option value="">Todos Admins</option>
          {admins.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando demandas...</div>
      ) : demandsList.length === 0 ? (
        <div className={styles.empty}>Nenhuma demanda encontrada</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Titulo</th>
                <th>Categoria</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Solicitante</th>
                <th>Admin Responsavel</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {demandsList.map(d => {
                const st = STATUS_MAP[d.status] || { label: d.status, style: '' };
                const pr = PRIORITY_MAP[d.priority] || { label: d.priority, style: '' };
                return (
                  <tr key={d.id}>
                    <td>{d.id}</td>
                    <td><span className={styles.demandTitle}>{d.title}</span></td>
                    <td><span className={styles.categoryTag}>{CATEGORY_LABELS[d.category] || d.category}</span></td>
                    <td><span className={`${styles.priorityBadge} ${styles[pr.style]}`}>{pr.label}</span></td>
                    <td><span className={`${styles.statusBadge} ${styles[st.style]}`}>{st.label}</span></td>
                    <td>{d.requester_name}</td>
                    <td>
                      <select
                        className={styles.redirectSelect}
                        value={d.assigned_to || ''}
                        onChange={(e) => handleRedirect(d.id, e.target.value)}
                      >
                        <option value="">Nao atribuido</option>
                        {admins.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td><span className={styles.dateCell}>{formatDate(d.created_at)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
