import styles from '../styles/DemandCard.module.css';

const CATEGORY_LABELS = {
  feature: 'Feature',
  bug: 'Bug',
  melhoria: 'Melhoria',
  tarefa_tecnica: 'Técnica',
  documentacao: 'Docs',
};

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export default function DemandCard({ demand, onDragStart, onClick }) {
  const isUrgentPending = demand.priority === 'urgente' && demand.urgent_approved === null;
  const isUrgentApproved = demand.priority === 'urgente' && demand.urgent_approved === true;
  const isUrgentRejected = demand.priority === 'urgente' && demand.urgent_approved === false;

  const daysUntilDue = demand.due_date
    ? Math.ceil((new Date(demand.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className={`${styles.card} ${isUrgentApproved ? styles.urgentApproved : ''} ${isUrgentPending ? styles.urgentPending : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, demand)}
      onClick={onClick}
    >
      <div className={styles.top}>
        <span className={`priority-badge priority-${demand.priority}`}>
          {isUrgentPending && '⏳ '}
          {isUrgentRejected && '✗ '}
          {isUrgentApproved && '⚡ '}
          {PRIORITY_LABELS[demand.priority]}
        </span>
        <span className="category-tag">{CATEGORY_LABELS[demand.category]}</span>
      </div>

      <h3 className={styles.title}>{demand.title}</h3>

      <p className={styles.desc}>
        {demand.description.length > 100 ? demand.description.slice(0, 100) + '...' : demand.description}
      </p>

      <div className={styles.footer}>
        <div className={styles.meta}>
          {demand.story_points && (
            <span className={styles.points}>{demand.story_points} pts</span>
          )}
          {demand.requester_name && (
            <span className={styles.requester}>{demand.requester_name}</span>
          )}
        </div>
        <div className={styles.meta}>
          {demand.assigned_name && (
            <span className={styles.assigned}>→ {demand.assigned_name}</span>
          )}
          {daysUntilDue !== null && (
            <span className={`${styles.due} ${daysUntilDue < 0 ? styles.overdue : daysUntilDue <= 2 ? styles.dueSoon : ''}`}>
              {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d atrasado` : daysUntilDue === 0 ? 'Hoje' : `${daysUntilDue}d`}
            </span>
          )}
        </div>
      </div>

      <div className={styles.id}>#{demand.id}</div>
    </div>
  );
}
