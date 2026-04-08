import { useState, useEffect } from 'react';
import { demands as demandsApi, comments as commentsApi, users as usersApi, scrum as scrumApi, attachments as attachApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/DemandModal.module.css';

const STATUS_LABELS = {
  backlog: 'Backlog',
  sprint_backlog: 'Sprint Backlog',
  em_progresso: 'Em Progresso',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const CATEGORY_LABELS = {
  feature: 'Nova Feature', bug: 'Bug / Correção', melhoria: 'Melhoria',
  tarefa_tecnica: 'Tarefa Técnica', documentacao: 'Documentação',
};

export default function DemandModal({ demand, onClose, onUpdate }) {
  const { isAdmin, canManage } = useAuth();
  const [commentsList, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [sprintsList, setSprintsList] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(demand.sprint_id || '');
  const [assignTo, setAssignTo] = useState(demand.assigned_to || '');
  const [urgentNote, setUrgentNote] = useState('');
  const [attachList, setAttachList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadAttachments = () => attachApi.list(demand.id).then(setAttachList).catch(() => {});

  useEffect(() => {
    commentsApi.list(demand.id).then(setComments).catch(() => {});
    loadAttachments();
    if (canManage) {
      usersApi.list().then(setUsersList).catch(() => {});
      scrumApi.sprints().then(setSprintsList).catch(() => {});
    }
  }, [demand.id, canManage]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    await commentsApi.create(demand.id, newComment);
    setNewComment('');
    const updated = await commentsApi.list(demand.id);
    setComments(updated);
  };

  const changeStatus = async (status) => {
    await demandsApi.updateStatus(demand.id, status);
    onUpdate();
    onClose();
  };

  const handleAssign = async () => {
    if (!assignTo) return;
    await demandsApi.update(demand.id, { ...demand, assigned_to: parseInt(assignTo) });
    onUpdate();
  };

  const handleSprintChange = async () => {
    await demandsApi.update(demand.id, { ...demand, sprint_id: selectedSprint ? parseInt(selectedSprint) : null });
    onUpdate();
  };

  const handleUrgentDecision = async (approved) => {
    await demandsApi.urgentDecision(demand.id, approved, urgentNote);
    onUpdate();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta demanda?')) return;
    await demandsApi.delete(demand.id);
    onUpdate();
    onClose();
  };

  const handleUploadFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setUploadError('');
    try {
      await attachApi.upload(demand.id, files);
      await loadAttachments();
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttach = async (id) => {
    await attachApi.delete(id);
    await loadAttachments();
  };

  const isUrgentPending = demand.priority === 'urgente' && demand.urgent_approved === null;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (mime) => mime?.startsWith('image/');
  const isPdf = (mime) => mime === 'application/pdf';
  const isVideo = (mime) => mime?.startsWith('video/');

  const getFileIcon = (mime) => {
    if (isImage(mime)) return '🖼';
    if (isPdf(mime)) return '📄';
    if (isVideo(mime)) return '🎬';
    return '📎';
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <span className={`priority-badge priority-${demand.priority}`}>
              {demand.priority.charAt(0).toUpperCase() + demand.priority.slice(1)}
            </span>
            <span className="category-tag">{CATEGORY_LABELS[demand.category]}</span>
            <span className={styles.demandId}>#{demand.id}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <h2 className={styles.demandTitle}>{demand.title}</h2>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.infoValue}>{STATUS_LABELS[demand.status]}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Solicitante</span>
              <span className={styles.infoValue}>{demand.requester_name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Story Points</span>
              <span className={styles.infoValue}>{demand.story_points || '—'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data Desejada</span>
              <span className={styles.infoValue}>{formatDate(demand.due_date)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Criada em</span>
              <span className={styles.infoValue}>{formatDate(demand.created_at)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Responsável</span>
              <span className={styles.infoValue}>{demand.assigned_name || 'Não atribuído'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Sprint</span>
              <span className={styles.infoValue}>{demand.sprint_name || 'Nenhuma'}</span>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <h3>Descrição</h3>
            <p className={styles.description}>{demand.description}</p>
          </div>

          {demand.acceptance_criteria && (
            <div className={styles.sectionBlock}>
              <h3>Critérios de Aceitação</h3>
              <p className={styles.description}>{demand.acceptance_criteria}</p>
            </div>
          )}

          {/* Urgent approval block (admin only) */}
          {canManage && isUrgentPending && (
            <div className={styles.urgentBlock}>
              <h3>Decisão de Urgência</h3>
              <p>Esta demanda foi marcada como urgente. Deseja aprovar que ela fure a fila?</p>
              <textarea
                value={urgentNote}
                onChange={e => setUrgentNote(e.target.value)}
                placeholder="Nota sobre a decisão (opcional)..."
                rows={2}
              />
              <div className={styles.urgentActions}>
                <button className="btn btn-success btn-sm" onClick={() => handleUrgentDecision(true)}>Aprovar Urgência</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleUrgentDecision(false)}>Rejeitar Urgência</button>
              </div>
            </div>
          )}

          {/* Status actions (admin/supervisor) */}
          {canManage && (
            <div className={styles.sectionBlock}>
              <h3>Mover para</h3>
              <div className={styles.statusActions}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  key !== demand.status && (
                    <button key={key} className="btn btn-ghost btn-sm" onClick={() => changeStatus(key)}>
                      {label}
                    </button>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Assign (admin/supervisor) */}
          {canManage && (
            <div className={styles.sectionBlock}>
              <h3>Atribuir Responsável</h3>
              <div className={styles.assignRow}>
                <select value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                  <option value="">Selecione...</option>
                  {usersList.filter(u => u.role !== 'user').map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAssign}>Atribuir</button>
              </div>
            </div>
          )}

          {/* Sprint association (admin/supervisor) */}
          {canManage && (
            <div className={styles.sectionBlock}>
              <h3>Associar à Sprint</h3>
              <div className={styles.assignRow}>
                <select value={selectedSprint} onChange={e => setSelectedSprint(e.target.value)}>
                  <option value="">Sem sprint</option>
                  {sprintsList.filter(s => s.status !== 'completed').map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.status === 'active' ? 'Ativa' : 'Planejamento'})</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleSprintChange}>Salvar</button>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className={styles.sectionBlock}>
            <h3>Anexos ({attachList.length})</h3>
            {attachList.length > 0 && (
              <div className={styles.attachGrid}>
                {attachList.map(a => (
                  <div key={a.id} className={styles.attachItem}>
                    {isImage(a.mime_type) ? (
                      <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachThumb}>
                        <img src={`/uploads/${a.filename}`} alt={a.original_name} />
                      </a>
                    ) : isVideo(a.mime_type) ? (
                      <video src={`/uploads/${a.filename}`} controls className={styles.attachVideo} />
                    ) : (
                      <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachFile}>
                        <span className={styles.attachIcon}>{getFileIcon(a.mime_type)}</span>
                      </a>
                    )}
                    <div className={styles.attachInfo}>
                      <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachName}>{a.original_name}</a>
                      <span className={styles.attachMeta}>{formatSize(a.size)} — {a.user_name}</span>
                    </div>
                    {(a.user_id === demand.requester_id || isAdmin) && (
                      <button className={styles.attachDelete} onClick={() => handleDeleteAttach(a.id)} title="Remover">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {attachList.length === 0 && <p className={styles.noComments}>Nenhum anexo.</p>}
            {uploadError && <p style={{ color: 'var(--priority-urgente)', fontSize: '0.82rem', marginTop: '0.4rem' }}>{uploadError}</p>}
            <div className={styles.attachUpload}>
              <label className={styles.uploadLabel}>
                <input type="file" multiple onChange={handleUploadFiles} style={{ display: 'none' }} disabled={uploading} />
                <span className="btn btn-ghost btn-sm">{uploading ? 'Enviando...' : '+ Adicionar Anexo'}</span>
              </label>
            </div>
          </div>

          {/* Comments */}
          <div className={styles.sectionBlock}>
            <h3>Comentários ({commentsList.length})</h3>
            <div className={styles.commentsList}>
              {commentsList.map(c => (
                <div key={c.id} className={styles.comment}>
                  <div className={styles.commentHeader}>
                    <strong>{c.user_name}</strong>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                  <p>{c.content}</p>
                </div>
              ))}
              {commentsList.length === 0 && <p className={styles.noComments}>Nenhum comentário ainda.</p>}
            </div>
            <div className={styles.addComment}>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                rows={2}
              />
              <button className="btn btn-primary btn-sm" onClick={addComment}>Enviar</button>
            </div>
          </div>

          {isAdmin && (
            <div className={styles.dangerZone}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Excluir Demanda</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
