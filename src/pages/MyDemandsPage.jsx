import { useState, useEffect } from 'react';
import { useDemands } from '../hooks/useDemands';
import { demands as demandsApi } from '../services/api';
import styles from '../styles/MyDemandsPage.module.css';

const STATUS_LABELS = {
  backlog: 'Backlog',
  sprint_backlog: 'Sprint Backlog',
  em_progresso: 'Em Progresso',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const PRIORITY_LABELS = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

const CATEGORY_LABELS = {
  feature: 'Feature', bug: 'Bug', melhoria: 'Melhoria',
  tarefa_tecnica: 'Técnica', documentacao: 'Docs',
};

export default function MyDemandsPage() {
  const { demands, loading } = useDemands();
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [tab, setTab] = useState('minhas');

  useEffect(() => {
    demandsApi.queue()
      .then(setQueue)
      .catch(() => {})
      .finally(() => setQueueLoading(false));
  }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const myPositions = queue.filter(q => q.is_mine);

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.heading}>
          <h1>Minhas Demandas</h1>
          <p>Acompanhe o status das suas solicitações e sua posição na fila</p>
        </div>

        <div className={styles.waitNotice}>
          O tempo mínimo de espera para atendimento é de <strong>pelo menos 2 semanas</strong> a partir do envio.
        </div>

        {/* Posição na fila — resumo rápido */}
        {myPositions.length > 0 && (
          <div className={styles.positionSummary}>
            {myPositions.map(q => (
              <div key={q.id} className={styles.positionCard}>
                <span className={styles.positionNumber}>#{q.position}</span>
                <div className={styles.positionInfo}>
                  <strong>{q.title}</strong>
                  <span className={styles.positionMeta}>
                    <span className={`priority-badge priority-${q.priority}`}>{PRIORITY_LABELS[q.priority]}</span>
                    <span>{STATUS_LABELS[q.status]}</span>
                    {q.is_urgent_approved && <span className={styles.urgentApproved}>Urgência aprovada</span>}
                  </span>
                </div>
                <span className={styles.positionLabel}>na fila</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'minhas' ? styles.activeTab : ''}`} onClick={() => setTab('minhas')}>
            Minhas Demandas ({demands.length})
          </button>
          <button className={`${styles.tab} ${tab === 'fila' ? styles.activeTab : ''}`} onClick={() => setTab('fila')}>
            Fila Completa ({queue.length})
          </button>
        </div>

        {tab === 'minhas' && (
          <>
            {loading ? (
              <div className={styles.loading}>Carregando...</div>
            ) : demands.length === 0 ? (
              <div className={styles.empty}>
                <p>Você ainda não enviou nenhuma demanda.</p>
              </div>
            ) : (
              <div className={styles.list}>
                {demands.map(d => (
                  <div key={d.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={`priority-badge priority-${d.priority}`}>{PRIORITY_LABELS[d.priority]}</span>
                      <span className="category-tag">{CATEGORY_LABELS[d.category]}</span>
                      <span className={styles.statusBadge} data-status={d.status}>{STATUS_LABELS[d.status]}</span>
                      <span className={styles.id}>#{d.id}</span>
                    </div>
                    <h3 className={styles.title}>{d.title}</h3>
                    <p className={styles.desc}>{d.description}</p>
                    <div className={styles.cardFooter}>
                      <span>Criada em {formatDate(d.created_at)}</span>
                      {d.story_points && <span>{d.story_points} pts</span>}
                      {d.due_date && <span>Entrega: {formatDate(d.due_date)}</span>}
                    </div>
                    {d.priority === 'urgente' && (
                      <div className={styles.urgentStatus}>
                        {d.urgent_approved === null && 'Aguardando aprovação de urgência...'}
                        {d.urgent_approved === true && 'Urgência aprovada pelo admin'}
                        {d.urgent_approved === false && `Urgência rejeitada${d.urgent_decision_note ? `: ${d.urgent_decision_note}` : ''}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'fila' && (
          <>
            {queueLoading ? (
              <div className={styles.loading}>Carregando fila...</div>
            ) : (
              <div className={styles.queueList}>
                <div className={styles.queueHeader}>
                  <span>#</span>
                  <span>Demanda</span>
                  <span>Categoria</span>
                  <span>Prioridade</span>
                  <span>Status</span>
                  <span>Criada em</span>
                </div>
                {queue.map(q => (
                  <div key={q.id} className={`${styles.queueRow} ${q.is_mine ? styles.queueMine : ''} ${q.is_urgent_approved ? styles.queueUrgent : ''}`}>
                    <span className={styles.queuePos}>{q.position}</span>
                    <div className={styles.queueTitle}>
                      <span>{q.title}</span>
                      {q.is_mine && <span className={styles.mineBadge}>Sua</span>}
                    </div>
                    <span className="category-tag">{CATEGORY_LABELS[q.category]}</span>
                    <span className={`priority-badge priority-${q.priority}`}>
                      {q.is_urgent_approved && '⚡ '}{PRIORITY_LABELS[q.priority]}
                    </span>
                    <span className={styles.statusBadge} data-status={q.status}>{STATUS_LABELS[q.status]}</span>
                    <span className={styles.queueDate}>{formatDate(q.created_at)}</span>
                  </div>
                ))}
                {queue.length === 0 && <div className={styles.empty}>A fila está vazia.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
