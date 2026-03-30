import { useState, useCallback } from 'react';
import { useDemands } from '../hooks/useDemands';
import { demands as demandsApi, stats as statsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import DemandCard from '../components/DemandCard';
import DemandModal from '../components/DemandModal';
import { useEffect } from 'react';
import styles from '../styles/BoardPage.module.css';

const COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'var(--status-backlog)' },
  { key: 'sprint_backlog', label: 'Sprint Backlog', color: 'var(--status-sprint)' },
  { key: 'em_progresso', label: 'Em Progresso', color: 'var(--status-progresso)' },
  { key: 'em_revisao', label: 'Em Revisão', color: 'var(--status-revisao)' },
  { key: 'concluido', label: 'Concluído', color: 'var(--status-concluido)' },
];

export default function BoardPage() {
  const [filters, setFilters] = useState({});
  const { grouped, loading, reload } = useDemands(filters);
  const [selectedDemand, setSelectedDemand] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [boardStats, setBoardStats] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    statsApi.get().then(setBoardStats).catch(() => {});
  }, [grouped]);

  const handleDragStart = (e, demand) => {
    e.dataTransfer.setData('demandId', demand.id);
    e.dataTransfer.setData('fromStatus', demand.status);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('demandId');
    const from = e.dataTransfer.getData('fromStatus');
    if (from === newStatus) return;
    try {
      await demandsApi.updateStatus(id, newStatus);
      await reload();
    } catch (err) {
      console.error('Erro ao mover:', err);
    }
  };

  const handleFilterChange = (key) => (e) => {
    setFilters(prev => ({ ...prev, [key]: e.target.value || undefined }));
  };

  const totalDemands = Object.values(grouped).flat().length;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.title}>Board</h1>
          {boardStats && (
            <div className={styles.statsRow}>
              <span className={styles.stat}>{totalDemands} demandas</span>
              {boardStats.urgentPending > 0 && (
                <span className={`${styles.stat} ${styles.urgentStat}`}>
                  {boardStats.urgentPending} urgente{boardStats.urgentPending > 1 ? 's' : ''} pendente{boardStats.urgentPending > 1 ? 's' : ''}
                </span>
              )}
              <span className={styles.stat}>{boardStats.completedPoints} pts concluídos</span>
            </div>
          )}
        </div>
        <div className={styles.filters}>
          <select onChange={handleFilterChange('priority')} defaultValue="">
            <option value="">Todas Prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <select onChange={handleFilterChange('category')} defaultValue="">
            <option value="">Todas Categorias</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="melhoria">Melhoria</option>
            <option value="tarefa_tecnica">Tarefa Técnica</option>
            <option value="documentacao">Documentação</option>
          </select>
          <button onClick={reload} className="btn btn-ghost btn-sm">Atualizar</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando board...</div>
      ) : (
        <div className={styles.board}>
          {COLUMNS.map(col => (
            <div
              key={col.key}
              className={`${styles.column} ${dragOverCol === col.key ? styles.columnDragOver : ''}`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className={styles.columnHeader}>
                <div className={styles.columnDot} style={{ background: col.color }} />
                <span className={styles.columnTitle}>{col.label}</span>
                <span className={styles.columnCount}>{grouped[col.key]?.length || 0}</span>
              </div>
              <div className={styles.columnBody}>
                {grouped[col.key]?.map(demand => (
                  <DemandCard
                    key={demand.id}
                    demand={demand}
                    onDragStart={handleDragStart}
                    onClick={() => setSelectedDemand(demand)}
                  />
                ))}
                {(!grouped[col.key] || grouped[col.key].length === 0) && (
                  <div className={styles.emptyCol}>Nenhuma demanda</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDemand && (
        <DemandModal
          demand={selectedDemand}
          onClose={() => setSelectedDemand(null)}
          onUpdate={reload}
        />
      )}
    </div>
  );
}
