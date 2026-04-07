import { useState, useEffect, useRef } from 'react';
import { design as designApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/DesignCardModal.module.css';

const STATUS_LABELS = {
  links: 'Links', demanda: 'Demanda', em_andamento: 'Em Andamento', analise: 'Análise',
  alteracoes: 'Alterações', concluidas: 'Concluídas', pos_gestores: 'Mandar Pós Gestores', reunioes: 'Reuniões',
};

const DELIVERY_TYPES = ['Criativo', 'Live'];

export default function DesignCardModal({ card, isAdmin, designers, onClose, onUpdate }) {
  const { user } = useAuth();
  const [checklist, setChecklist] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newCheckSection, setNewCheckSection] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [alterComment, setAlterComment] = useState('');
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [attachList, setAttachList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [linksList, setLinksList] = useState([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [drag, setDrag] = useState({ type: null, item: null, over: null });
  const dragRef = useRef(null);

  const loadAttachments = () => designApi.attachments(card.id).then(setAttachList).catch(() => {});
  const loadLinks = () => designApi.links(card.id).then(setLinksList).catch(() => {});

  useEffect(() => {
    designApi.checklist(card.id).then(setChecklist).catch(() => {});
    designApi.comments(card.id).then(setComments).catch(() => {});
    designApi.history(card.id).then(setHistory).catch(() => {});
    loadAttachments();
    loadLinks();
  }, [card.id]);

  const reload = () => {
    designApi.checklist(card.id).then(setChecklist).catch(() => {});
    designApi.comments(card.id).then(setComments).catch(() => {});
    designApi.history(card.id).then(setHistory).catch(() => {});
    loadAttachments();
    loadLinks();
  };

  const handleUploadFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      await designApi.uploadAttachments(card.id, files);
      await loadAttachments();
    } catch (err) { console.error(err); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteAttach = async (id) => {
    await designApi.deleteAttachment(id);
    await loadAttachments();
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;
    await designApi.addLink(card.id, newLinkUrl, newLinkLabel || null);
    setNewLinkUrl('');
    setNewLinkLabel('');
    await loadLinks();
  };

  const handleDeleteLink = async (id) => {
    await designApi.deleteLink(id);
    await loadLinks();
  };

  const handleToggleVisible = async () => {
    await designApi.toggleVisible(card.id);
    onUpdate();
    onClose();
  };

  const isImage = (mime) => mime?.startsWith('image/');
  const isVideo = (mime) => mime?.startsWith('video/');
  const getFileIcon = (mime) => {
    if (isImage(mime)) return '🖼';
    if (mime === 'application/pdf') return '📄';
    if (isVideo(mime)) return '🎬';
    return '📎';
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleToggleCheck = async (id) => {
    await designApi.toggleCheckItem(id);
    designApi.checklist(card.id).then(setChecklist);
  };

  const handleAddCheck = async (section) => {
    if (!newCheckItem.trim()) return;
    await designApi.addCheckItem(card.id, newCheckItem, section || undefined);
    setNewCheckItem('');
    designApi.checklist(card.id).then(setChecklist);
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    setNewCheckSection(newSectionName.trim());
    setNewSectionName('');
    setShowNewSection(false);
  };

  const handleDeleteCheck = async (id) => {
    await designApi.deleteCheckItem(id);
    designApi.checklist(card.id).then(setChecklist);
  };

  // Drag-and-drop genérico para checklist, anexos e links
  const makeDragHandlers = (type, list, setList, reorderFn, reloadFn) => ({
    onStart: (e, item) => {
      e.stopPropagation();
      dragRef.current = { type, item };
      setDrag({ type, item, over: null });
      e.dataTransfer.setData('text/plain', String(item.id));
      e.dataTransfer.effectAllowed = 'move';
    },
    onEnd: (e) => {
      e.stopPropagation();
      setDrag({ type: null, item: null, over: null });
      dragRef.current = null;
    },
    onOver: (e, item) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragRef.current?.type === type && dragRef.current.item.id !== item.id) {
        setDrag(d => ({ ...d, over: item }));
      }
    },
    onEnter: (e) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: async (e, targetItem) => {
      e.preventDefault();
      e.stopPropagation();
      const source = dragRef.current?.item;
      if (!source || dragRef.current?.type !== type || source.id === targetItem.id) {
        setDrag({ type: null, item: null, over: null }); dragRef.current = null; return;
      }
      const newList = [...list];
      const srcIdx = newList.findIndex(i => i.id === source.id);
      const tgtIdx = newList.findIndex(i => i.id === targetItem.id);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const [moved] = newList.splice(srcIdx, 1);
      if (type === 'check') moved.section = targetItem.section;
      newList.splice(tgtIdx, 0, moved);
      const updates = newList.map((item, idx) => {
        const u = { id: item.id, sort_order: idx };
        if (type === 'check') u.section = item.section || null;
        return u;
      });
      setList(newList);
      setDrag({ type: null, item: null, over: null });
      dragRef.current = null;
      try { await reorderFn(updates); } catch { reloadFn(); }
    },
  });

  const checkDrag = makeDragHandlers('check', checklist, setChecklist, designApi.reorderChecklist, () => designApi.checklist(card.id).then(setChecklist));
  const attachDrag = makeDragHandlers('attach', attachList, setAttachList, designApi.reorderAttachments, loadAttachments);
  const linkDrag = makeDragHandlers('link', linksList, setLinksList, designApi.reorderLinks, loadLinks);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await designApi.addComment(card.id, newComment);
    setNewComment('');
    designApi.comments(card.id).then(setComments);
  };

  const handleMove = async (status, comment) => {
    await designApi.moveCard(card.id, status, comment || undefined);
    onUpdate();
    onClose();
  };

  const handleApprove = () => handleMove('concluidas');
  const handleRequestChanges = () => {
    if (!alterComment.trim()) return alert('Adicione um comentario sobre a alteracao');
    handleMove('alteracoes', alterComment);
  };
  const handleStartWork = () => handleMove('em_andamento');
  const handleSendReview = () => handleMove('analise');

  const handleDelete = async () => {
    if (!confirm('Excluir este card?')) return;
    await designApi.deleteCard(card.id);
    onUpdate();
    onClose();
  };

  const startEdit = () => {
    setEditForm({
      title: card.title, expert_name: card.expert_name, description: card.description || '',
      delivery_type: card.delivery_type || '', priority: card.priority,
      designer_id: card.designer_id || '', start_date: card.start_date ? card.start_date.slice(0, 16) : '',
      deadline: card.deadline ? card.deadline.slice(0, 16) : '', estimated_hours: card.estimated_hours || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    await designApi.updateCard(card.id, {
      ...editForm,
      designer_id: editForm.designer_id ? parseInt(editForm.designer_id) : null,
      estimated_hours: editForm.estimated_hours ? parseFloat(editForm.estimated_hours) : null,
      start_date: editForm.start_date || null,
      deadline: editForm.deadline || null,
    });
    setEditing(false);
    onUpdate();
    onClose();
  };

  const isOverdue = card.deadline && new Date(card.deadline) < new Date() && card.status !== 'concluidas';
  const isMyCard = card.designer_id === user?.id;
  const isDesigner = user?.role === 'designer';
  const checkDone = checklist.filter(c => c.checked).length;
  const checkTotal = checklist.length;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  const formatDt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.headerTags}>
            <span className={`${styles.priBadge} ${styles[`pri_${card.priority}`]}`}>{card.priority}</span>
            <span className={styles.statusBadge}>{STATUS_LABELS[card.status]}</span>
            {isOverdue && <span className={styles.overdueBadge}>ATRASADO</span>}
            {card.visible_to_all && <span className={styles.visibleBadge}>TODOS</span>}
            <span className={styles.cardId}>#{card.id}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {!editing ? (
            <>
              <h2 className={styles.title}>{card.title}</h2>
              <div className={styles.infoGrid}>
                <div className={styles.info}><span className={styles.infoLbl}>Expert</span><span>{card.expert_name}</span></div>
                <div className={styles.info}><span className={styles.infoLbl}>Tipo</span><span>{card.delivery_type || '—'}</span></div>
                <div className={styles.info}><span className={styles.infoLbl}>Designer</span><span>{card.designer_name || 'Nao atribuido'}</span></div>
                <div className={styles.info}><span className={styles.infoLbl}>Inicio</span><span>{formatDt(card.start_date)}</span></div>
                <div className={styles.info}><span className={styles.infoLbl}>Deadline</span><span className={isOverdue ? styles.overdueText : ''}>{formatDt(card.deadline)}</span></div>
                <div className={styles.info}><span className={styles.infoLbl}>Estimativa</span><span>{card.estimated_hours ? `${card.estimated_hours}h` : '—'}</span></div>
              </div>
              {card.description && <div className={styles.section}><h3>Descricao</h3><p className={styles.desc}>{card.description}</p></div>}
              {isAdmin && <button className={styles.editBtn} onClick={startEdit}>Editar Card</button>}
            </>
          ) : (
            <div className={styles.editForm}>
              <input placeholder="Titulo" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
              <input placeholder="Expert" value={editForm.expert_name} onChange={e => setEditForm(p => ({ ...p, expert_name: e.target.value }))} />
              <select value={editForm.delivery_type} onChange={e => setEditForm(p => ({ ...p, delivery_type: e.target.value }))}>
                <option value="">Tipo de Entrega</option>
                {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={editForm.designer_id} onChange={e => setEditForm(p => ({ ...p, designer_id: e.target.value }))}>
                <option value="">Designer</option>
                {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
              <label className={styles.dtLabel}>Inicio<input type="datetime-local" value={editForm.start_date} onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))} /></label>
              <label className={styles.dtLabel}>Deadline<input type="datetime-local" value={editForm.deadline} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} /></label>
              <input type="number" step="0.5" placeholder="Horas" value={editForm.estimated_hours} onChange={e => setEditForm(p => ({ ...p, estimated_hours: e.target.value }))} />
              <textarea placeholder="Descricao" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />
              <div className={styles.editActions}>
                <button className={styles.btnGold} onClick={handleSaveEdit}>Salvar</button>
                <button className={styles.btnGhost} onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className={styles.tabs}>
            {['details', 'attachments', 'comments', 'history'].map(t => (
              <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                {{ details: 'Checklist', attachments: `Anexos (${attachList.length})`, comments: `Comentarios (${comments.length})`, history: 'Historico' }[t]}
              </button>
            ))}
          </div>

          {tab === 'details' && (() => {
            // Agrupar por section
            const sections = [];
            const sectionMap = {};
            checklist.forEach(item => {
              const key = item.section || '__none__';
              if (!sectionMap[key]) {
                sectionMap[key] = [];
                sections.push(key);
              }
              sectionMap[key].push(item);
            });
            const allSectionNames = [...new Set(checklist.map(i => i.section).filter(Boolean))];

            return (
              <div className={styles.section}>
                {checkTotal > 0 && (
                  <div className={styles.checkProgressBar}>
                    <div className={styles.checkBarOuter}><div className={styles.checkBarInner} style={{ width: `${checkPct}%` }} /></div>
                    <span>{checkDone}/{checkTotal} ({checkPct}%)</span>
                  </div>
                )}

                {sections.map(sectionKey => {
                  const items = sectionMap[sectionKey];
                  const sDone = items.filter(i => i.checked).length;
                  const sTotal = items.length;
                  const sPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;
                  const isNoSection = sectionKey === '__none__';

                  return (
                    <div key={sectionKey} className={styles.checkSection}>
                      {!isNoSection && (
                        <div className={styles.sectionHeader}>
                          <span className={styles.sectionTitle}>{sectionKey}</span>
                          <div className={styles.sectionProgress}>
                            <div className={styles.sectionBarOuter}><div className={styles.sectionBarInner} style={{ width: `${sPct}%` }} /></div>
                            <span>{sDone}/{sTotal}</span>
                          </div>
                        </div>
                      )}
                      <div className={styles.checkList}>
                        {items.map(item => {
                          const canEdit = isAdmin || isMyCard;
                          const isDragging = drag.type === 'check' && drag.item?.id === item.id;
                          const isOver = drag.type === 'check' && drag.over?.id === item.id && !isDragging;
                          return (
                            <div
                              key={item.id}
                              className={`${styles.checkItem} ${isDragging ? styles.dragItemActive : ''} ${isOver ? styles.dragItemOver : ''}`}
                              draggable={canEdit}
                              onDragStart={e => checkDrag.onStart(e, item)}
                              onDragEnd={checkDrag.onEnd}
                              onDragOver={e => checkDrag.onOver(e, item)}
                              onDragEnter={checkDrag.onEnter}
                              onDrop={e => checkDrag.onDrop(e, item)}
                            >
                              {canEdit && <span className={styles.dragHandle}>⠿</span>}
                              <input type="checkbox" checked={item.checked} onChange={() => handleToggleCheck(item.id)} />
                              <span className={item.checked ? styles.checkDone : ''}>{item.text}</span>
                              {canEdit && <button className={styles.checkDel} onClick={() => handleDeleteCheck(item.id)}>✕</button>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Adicionar item */}
                <div className={styles.addCheckRow}>
                  <select className={styles.sectionSelect} value={newCheckSection} onChange={e => setNewCheckSection(e.target.value)}>
                    <option value="">Sem setor</option>
                    {allSectionNames.map(s => <option key={s} value={s}>{s}</option>)}
                    {newCheckSection && !allSectionNames.includes(newCheckSection) && (
                      <option value={newCheckSection}>{newCheckSection}</option>
                    )}
                  </select>
                  <input placeholder="Novo item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCheck(newCheckSection))} />
                  <button className={styles.btnGold} onClick={() => handleAddCheck(newCheckSection)}>+</button>
                </div>

                {/* Criar novo setor */}
                {!showNewSection ? (
                  <button className={styles.addSectionBtn} onClick={() => setShowNewSection(true)}>+ Novo Setor</button>
                ) : (
                  <div className={styles.addCheckRow}>
                    <input placeholder="Nome do setor..." value={newSectionName} onChange={e => setNewSectionName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSection())} />
                    <button className={styles.btnGold} onClick={handleAddSection}>Criar</button>
                    <button className={styles.btnGhost} onClick={() => setShowNewSection(false)}>✕</button>
                  </div>
                )}
              </div>
            );
          })()}

          {tab === 'attachments' && (
            <div className={styles.section}>
              {attachList.length > 0 && (
                <div className={styles.attachGrid}>
                  {attachList.map(a => {
                    const canEdit = a.user_id === user?.id || isAdmin;
                    const isDragging = drag.type === 'attach' && drag.item?.id === a.id;
                    const isOver = drag.type === 'attach' && drag.over?.id === a.id && !isDragging;
                    return (
                      <div
                        key={a.id}
                        className={`${styles.attachItem} ${isDragging ? styles.dragItemActive : ''} ${isOver ? styles.dragItemOver : ''}`}
                        draggable={canEdit}
                        onDragStart={e => attachDrag.onStart(e, a)}
                        onDragEnd={attachDrag.onEnd}
                        onDragOver={e => attachDrag.onOver(e, a)}
                        onDragEnter={attachDrag.onEnter}
                        onDrop={e => attachDrag.onDrop(e, a)}
                      >
                        {canEdit && <span className={styles.dragHandle}>⠿</span>}
                        {isImage(a.mime_type) ? (
                          <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachThumb}>
                            <img src={`/uploads/${a.filename}`} alt={a.original_name} />
                          </a>
                        ) : isVideo(a.mime_type) ? (
                          <video src={`/uploads/${a.filename}`} controls className={styles.attachVideo} />
                        ) : (
                          <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachFileIcon}>
                            <span>{getFileIcon(a.mime_type)}</span>
                          </a>
                        )}
                        <div className={styles.attachInfo}>
                          <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className={styles.attachName}>{a.original_name}</a>
                          <span className={styles.attachMeta}>{formatSize(a.size)} — {a.user_name}</span>
                        </div>
                        {canEdit && (
                          <button className={styles.attachDel} onClick={() => handleDeleteAttach(a.id)}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {attachList.length === 0 && <p className={styles.empty}>Nenhum anexo.</p>}
              <div className={styles.attachUpload}>
                <label className={styles.uploadLabel}>
                  <input type="file" multiple onChange={handleUploadFiles} style={{ display: 'none' }} />
                  <span className={styles.btnGhost}>{uploading ? 'Enviando...' : '+ Adicionar Anexos'}</span>
                </label>
              </div>

              {/* Links */}
              <div className={styles.linksSection}>
                <h4 className={styles.linksTitle}>Links</h4>
                {linksList.length > 0 && (
                  <div className={styles.linksList}>
                    {linksList.map(l => {
                      const canEdit = l.user_id === user?.id || isAdmin;
                      const isDragging = drag.type === 'link' && drag.item?.id === l.id;
                      const isOver = drag.type === 'link' && drag.over?.id === l.id && !isDragging;
                      return (
                        <div
                          key={l.id}
                          className={`${styles.linkItem} ${isDragging ? styles.dragItemActive : ''} ${isOver ? styles.dragItemOver : ''}`}
                          draggable={canEdit}
                          onDragStart={e => linkDrag.onStart(e, l)}
                          onDragEnd={linkDrag.onEnd}
                          onDragOver={e => linkDrag.onOver(e, l)}
                          onDragEnter={linkDrag.onEnter}
                          onDrop={e => linkDrag.onDrop(e, l)}
                        >
                          {canEdit && <span className={styles.dragHandle}>⠿</span>}
                          <span className={styles.linkIcon}>🔗</span>
                          <div className={styles.linkInfo}>
                            <a href={l.url} target="_blank" rel="noreferrer" className={styles.linkUrl}>{l.label || l.url}</a>
                            {l.label && <span className={styles.linkMeta}>{l.url}</span>}
                            <span className={styles.linkMeta}>{l.user_name}</span>
                          </div>
                          {canEdit && (
                            <button className={styles.attachDel} onClick={() => handleDeleteLink(l.id)}>✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {linksList.length === 0 && <p className={styles.empty}>Nenhum link.</p>}
                <div className={styles.addLinkRow}>
                  <input placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className={styles.linkInput} />
                  <input placeholder="Nome (opcional)" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} className={styles.linkLabelInput} />
                  <button className={styles.btnGold} onClick={handleAddLink}>+</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className={styles.section}>
              <div className={styles.commentsList}>
                {comments.map(c => (
                  <div key={c.id} className={styles.comment}>
                    <div className={styles.commentHead}><strong>{c.user_name}</strong><span>{formatDate(c.created_at)}</span></div>
                    <p>{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className={styles.empty}>Nenhum comentario.</p>}
              </div>
              <div className={styles.addComment}>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comentar..." rows={2} />
                <button className={styles.btnGold} onClick={handleAddComment}>Enviar</button>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className={styles.section}>
              <div className={styles.historyList}>
                {history.map(h => (
                  <div key={h.id} className={styles.historyItem}>
                    <span className={styles.historyDot} />
                    <div>
                      <strong>{h.user_name}</strong> — {h.action}
                      {h.from_status && <span className={styles.historyMove}> ({STATUS_LABELS[h.from_status]} → {STATUS_LABELS[h.to_status]})</span>}
                      {h.details && <p className={styles.historyDetails}>{h.details}</p>}
                      <span className={styles.historyDate}>{formatDt(h.created_at)}</span>
                    </div>
                  </div>
                ))}
                {history.length === 0 && <p className={styles.empty}>Sem historico.</p>}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={styles.actions}>
            {/* Editor: Demanda -> Em Andamento */}
            {isDesigner && isMyCard && card.status === 'demanda' && (
              <button className={styles.btnGold} onClick={handleStartWork}>Iniciar Trabalho</button>
            )}
            {/* Editor: Em Andamento -> Analise (concluir = enviar pra revisao) */}
            {isDesigner && isMyCard && card.status === 'em_andamento' && (
              <button className={styles.btnApprove} onClick={handleSendReview}>Concluido</button>
            )}
            {/* Editor: Alteracoes -> Analise (corrigiu e reenvia) */}
            {isDesigner && isMyCard && card.status === 'alteracoes' && (
              <button className={styles.btnApprove} onClick={handleSendReview}>Concluido</button>
            )}
            {/* Admin: Analise -> Aprovar ou Pedir Alteracao */}
            {isAdmin && card.status === 'analise' && (
              <>
                <button className={styles.btnApprove} onClick={handleApprove}>Aprovar</button>
                <div className={styles.alterBlock}>
                  <textarea value={alterComment} onChange={e => setAlterComment(e.target.value)} placeholder="Descreva a alteracao necessaria..." rows={2} />
                  <button className={styles.btnAlter} onClick={handleRequestChanges}>Pedir Alteracao</button>
                </div>
              </>
            )}
            {/* Admin: toggle visible to all */}
            {isAdmin && (
              <button className={card.visible_to_all ? styles.btnGold : styles.btnGhost} onClick={handleToggleVisible}>
                {card.visible_to_all ? '👁 Visível para todos' : '👁 Exibir para todo o time'}
              </button>
            )}
            {/* Admin: move to any column */}
            {isAdmin && card.status !== 'analise' && (
              <div className={styles.moveRow}>
                <span className={styles.moveLbl}>Mover para:</span>
                <div className={styles.moveButtons}>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== card.status).map(([k, v]) => (
                    <button key={k} className={styles.btnGhost} onClick={() => handleMove(k)}>{v}</button>
                  ))}
                </div>
              </div>
            )}
            {isAdmin && (
              <div className={styles.dangerZone}>
                <button className={styles.btnDanger} onClick={handleDelete}>Excluir Card</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
