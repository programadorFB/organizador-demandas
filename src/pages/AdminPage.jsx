import { useState, useEffect } from 'react';
import { users as usersApi, demands as demandsApi } from '../services/api';
import styles from '../styles/AdminPage.module.css';

export default function AdminPage() {
  const [tab, setTab] = useState('urgentes');
  const [usersList, setUsers] = useState([]);
  const [urgentList, setUrgent] = useState([]);
  const [notes, setNotes] = useState({});

  useEffect(() => {
    usersApi.list().then(setUsers).catch(() => {});
    demandsApi.urgentPending().then(setUrgent).catch(() => {});
  }, []);

  const handleRoleChange = async (userId, role) => {
    await usersApi.updateRole(userId, role);
    const updated = await usersApi.list();
    setUsers(updated);
  };

  const handleToggleActive = async (userId) => {
    await usersApi.toggleActive(userId);
    const updated = await usersApi.list();
    setUsers(updated);
  };

  const handleUrgentDecision = async (id, approved) => {
    await demandsApi.urgentDecision(id, approved, notes[id] || '');
    const updated = await demandsApi.urgentPending();
    setUrgent(updated);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h1 className={styles.title}>Painel Admin</h1>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'urgentes' ? styles.activeTab : ''}`} onClick={() => setTab('urgentes')}>
            Urgentes Pendentes
            {urgentList.length > 0 && <span className={styles.tabBadge}>{urgentList.length}</span>}
          </button>
          <button className={`${styles.tab} ${tab === 'usuarios' ? styles.activeTab : ''}`} onClick={() => setTab('usuarios')}>
            Usuários ({usersList.length})
          </button>
        </div>

        {tab === 'urgentes' && (
          <div className={styles.section}>
            {urgentList.length === 0 ? (
              <div className={styles.empty}>Nenhuma demanda urgente pendente de aprovação.</div>
            ) : (
              <div className={styles.urgentList}>
                {urgentList.map(d => (
                  <div key={d.id} className={styles.urgentCard}>
                    <div className={styles.urgentHeader}>
                      <span className="priority-badge priority-urgente">Urgente</span>
                      <span className={styles.urgentId}>#{d.id}</span>
                      <span className={styles.urgentDate}>{formatDate(d.created_at)}</span>
                    </div>
                    <h3>{d.title}</h3>
                    <p className={styles.urgentDesc}>{d.description}</p>
                    <div className={styles.urgentMeta}>
                      <span>Solicitante: <strong>{d.requester_name}</strong></span>
                      {d.story_points && <span>{d.story_points} pts</span>}
                      {d.due_date && <span>Entrega: {formatDate(d.due_date)}</span>}
                    </div>
                    <textarea
                      className={styles.noteInput}
                      placeholder="Nota sobre a decisão (opcional)..."
                      value={notes[d.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [d.id]: e.target.value }))}
                      rows={2}
                    />
                    <div className={styles.urgentActions}>
                      <button className="btn btn-success btn-sm" onClick={() => handleUrgentDecision(d.id, true)}>
                        Aprovar — Furar a Fila
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleUrgentDecision(d.id, false)}>
                        Rejeitar — Manter na Fila
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'usuarios' && (
          <div className={styles.section}>
            <div className={styles.userTable}>
              <div className={styles.tableHeader}>
                <span>Nome</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Ações</span>
              </div>
              {usersList.map(u => (
                <div key={u.id} className={styles.tableRow}>
                  <span className={styles.userName}>{u.name}</span>
                  <span className={styles.userEmail}>{u.email}</span>
                  <span>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className={styles.roleSelect}
                    >
                      <option value="user">User</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </span>
                  <span className={u.active ? styles.active : styles.inactive}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(u.id)}>
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
