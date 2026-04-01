import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { design as designApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import DesignCardModal from '../components/DesignCardModal';
import styles from '../styles/DesignBoard.module.css';

const ALL_COLUMNS = [
  { key: 'links', label: 'Links', color: '#6c5ce7' },
  { key: 'demanda', label: 'Demanda', color: '#C9971A' },
  { key: 'em_andamento', label: 'Em Andamento', color: '#0984e3' },
  { key: 'analise', label: 'Análise', color: '#fdcb6e' },
  { key: 'alteracoes', label: 'Alterações', color: '#ff6b35' },
  { key: 'concluidas', label: 'Concluídas', color: '#00b894' },
  { key: 'pos_gestores', label: 'Mandar Pós Gestores', color: '#a29bfe' },
  { key: 'reunioes', label: 'Reuniões', color: '#fd79a8' },
];

const EDITOR_COLUMNS = ['links', 'demanda', 'em_andamento', 'alteracoes'];
const EDITOR_ALLOWED_MOVES = { demanda: ['em_andamento'], em_andamento: ['analise'], alteracoes: ['analise'] };

const DELIVERY_TYPES = ['Criativo', 'Live'];

export default function DesignBoardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isDesignAdmin = user && ['admin', 'design_admin'].includes(user.role);
  const columns = isDesignAdmin ? ALL_COLUMNS : ALL_COLUMNS.filter(c => EDITOR_COLUMNS.includes(c.key));

  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [filterDesigner, setFilterDesigner] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [bgImage, setBgImage] = useState(() => localStorage.getItem('design_bg') || '');
  const [showBgInput, setShowBgInput] = useState(false);
  const [dragCardStatus, setDragCardStatus] = useState(null);
  const [showManageDesigners, setShowManageDesigners] = useState(false);
  const [newDesigner, setNewDesigner] = useState({ name: '', email: '', password: '' });
  const [newCard, setNewCard] = useState({ title: '', expert_name: '', delivery_type: '', priority: 'normal', designer_id: '', start_date: '', deadline: '', estimated_hours: '', description: '', status: 'demanda' });
  const [ncChecklist, setNcChecklist] = useState([]);
  const [ncNewItem, setNcNewItem] = useState('');
  const [ncNewSection, setNcNewSection] = useState('');
  const [ncShowNewSection, setNcShowNewSection] = useState(false);
  const [ncNewSectionName, setNcNewSectionName] = useState('');
  const [ncFiles, setNcFiles] = useState([]);

  const loadCards = useCallback(async () => {
    try {
      const params = {};
      if (filterDesigner) params.designer_id = filterDesigner;
      const list = await designApi.cards(params);
      setCards(list);
    } catch { /* ignore */ }
  }, [filterDesigner]);

  const loadNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([designApi.notifications(), designApi.unreadCount()]);
      setNotifications(notifs);
      setUnreadCount(count.count);
    } catch { /* ignore */ }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const d = await designApi.designers();
      setDesigners(d);
      if (isDesignAdmin) {
        const s = await designApi.stats();
        setStats(s);
      }
    } catch { /* ignore */ }
  }, [isDesignAdmin]);

  useEffect(() => { loadCards(); }, [loadCards]);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  // Poll a cada 15s
  useEffect(() => {
    const interval = setInterval(() => { loadCards(); loadNotifications(); }, 15000);
    return () => clearInterval(interval);
  }, [loadCards, loadNotifications]);

  const handleMarkAllRead = async () => {
    await designApi.readAllNotifications();
    setUnreadCount(0);
    setNotifications(n => n.map(x => ({ ...x, read: true })));
  };

  const handleBgSave = (url) => {
    setBgImage(url);
    localStorage.setItem('design_bg', url);
    setShowBgInput(false);
  };

  const handleCreateDesigner = async (e) => {
    e.preventDefault();
    try {
      await designApi.createDesigner(newDesigner);
      setNewDesigner({ name: '', email: '', password: '' });
      loadMeta();
    } catch (err) { alert(err.message); }
  };

  const handleToggleDesigner = async (id) => {
    await designApi.toggleDesigner(id);
    loadMeta();
  };

  const grouped = {};
  ALL_COLUMNS.forEach(c => { grouped[c.key] = []; });
  cards.forEach(c => { if (grouped[c.status]) grouped[c.status].push(c); });

  const canDragCard = (card) => {
    if (isDesignAdmin) return true;
    // Editor so pode arrastar seus proprios cards que estejam em status com transicoes permitidas
    return card.designer_id === user?.id && EDITOR_ALLOWED_MOVES[card.status];
  };

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('fromStatus', card.status);
    setDragCardStatus(card.status);
  };
  const handleDragOver = (e, col) => {
    e.preventDefault();
    // Editor: so highlight colunas validas
    if (!isDesignAdmin && dragCardStatus) {
      const allowed = EDITOR_ALLOWED_MOVES[dragCardStatus];
      if (!allowed?.includes(col)) return;
    }
    setDragOverCol(col);
  };
  const handleDragLeave = () => setDragOverCol(null);
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragCardStatus(null);
    const id = e.dataTransfer.getData('cardId');
    const from = e.dataTransfer.getData('fromStatus');
    if (from === newStatus) return;
    try {
      await designApi.moveCard(id, newStatus);
      loadCards();
      loadMeta();
    } catch (err) { alert(err.message); }
  };

  const handleCreateCard = async (e) => {
    e.preventDefault();
    try {
      const card = await designApi.createCard({
        ...newCard,
        designer_id: newCard.designer_id ? parseInt(newCard.designer_id) : null,
        estimated_hours: newCard.estimated_hours ? parseFloat(newCard.estimated_hours) : null,
        start_date: newCard.start_date || null,
        deadline: newCard.deadline || null,
      });
      // Adicionar checklist items
      for (const item of ncChecklist) {
        await designApi.addCheckItem(card.id, item.text, item.section || undefined);
      }
      // Upload de anexos
      if (ncFiles.length > 0) {
        await designApi.uploadAttachments(card.id, ncFiles);
      }
      setNewCard({ title: '', expert_name: '', delivery_type: '', priority: 'normal', designer_id: '', start_date: '', deadline: '', estimated_hours: '', description: '', status: 'demanda' });
      setNcChecklist([]);
      setNcFiles([]);
      setNcNewItem('');
      setNcNewSection('');
      setShowNewCard(false);
      loadCards();
      loadMeta();
    } catch (err) { alert(err.message); }
  };

  const ncAddItem = () => {
    if (!ncNewItem.trim()) return;
    setNcChecklist(prev => [...prev, { text: ncNewItem, section: ncNewSection || null }]);
    setNcNewItem('');
  };
  const ncRemoveItem = (idx) => setNcChecklist(prev => prev.filter((_, i) => i !== idx));
  const ncAddSection = () => {
    if (!ncNewSectionName.trim()) return;
    setNcNewSection(ncNewSectionName.trim());
    setNcNewSectionName('');
    setNcShowNewSection(false);
  };
  const ncAddFiles = (e) => {
    setNcFiles(prev => [...prev, ...Array.from(e.target.files)]);
    e.target.value = '';
  };
  const ncRemoveFile = (idx) => setNcFiles(prev => prev.filter((_, i) => i !== idx));
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleLogout = () => { logout(); navigate('/design'); };

  const isOverdue = (card) => card.deadline && new Date(card.deadline) < new Date() && card.status !== 'concluidas';

  const formatDt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const bgStyle = bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

  return (
    <div className={styles.page} style={bgStyle}>
      {bgImage && <div className={styles.bgOverlay} />}
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>FUZABALTA</h1>
          <span className={styles.subtitle}>Design Board</span>
        </div>
        {isDesignAdmin && stats && (
          <div className={styles.statsRow}>
            <div className={styles.statBox}><span className={styles.statVal}>{stats.active}</span><span className={styles.statLbl}>Ativos</span></div>
            <div className={styles.statBox}><span className={styles.statVal}>{stats.done}</span><span className={styles.statLbl}>Concluidos</span></div>
            <div className={`${styles.statBox} ${stats.overdue > 0 ? styles.statDanger : ''}`}><span className={styles.statVal}>{stats.overdue}</span><span className={styles.statLbl}>Atrasados</span></div>
            <div className={`${styles.statBox} ${stats.urgent > 0 ? styles.statUrgent : ''}`}><span className={styles.statVal}>{stats.urgent}</span><span className={styles.statLbl}>Urgentes</span></div>
          </div>
        )}
        <div className={styles.headerRight}>
          {/* Notificacoes */}
          <div className={styles.notifWrap}>
            <button className={styles.notifBtn} onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) loadNotifications(); }}>
              <span>🔔</span>
              {unreadCount > 0 && <span className={styles.notifBadge}>{unreadCount}</span>}
            </button>
            {showNotifs && (
              <>
                <div className={styles.notifOverlay} onClick={() => setShowNotifs(false)} />
                <div className={styles.notifDropdown}>
                  <div className={styles.notifHeader}>
                    <span>Notificações</span>
                    {unreadCount > 0 && <button className={styles.notifClear} onClick={handleMarkAllRead}>Marcar lidas</button>}
                  </div>
                  <div className={styles.notifList}>
                    {notifications.length === 0 && <p className={styles.notifEmpty}>Nenhuma notificação.</p>}
                    {notifications.map(n => (
                      <div key={n.id} className={`${styles.notifItem} ${styles[`notif_${n.type}`]} ${!n.read ? styles.notifUnread : ''}`}>
                        <p>{n.message}</p>
                        <span>{new Date(n.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {isDesignAdmin && (
            <>
              <select className={styles.filterSelect} value={filterDesigner} onChange={e => setFilterDesigner(e.target.value)}>
                <option value="">Todos Designers</option>
                {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className={styles.btnGold} onClick={() => setShowNewCard(!showNewCard)}>
                {showNewCard ? 'Cancelar' : '+ Nova Demanda'}
              </button>
              <button className={styles.bgBtn} onClick={() => setShowBgInput(!showBgInput)} title="Plano de fundo">🖼</button>
              <button className={styles.btnGold} onClick={() => navigate('/design/analytics')}>📊 Analytics</button>
              <button className={styles.btnGhost} onClick={() => setShowManageDesigners(!showManageDesigners)}>👥 Designers</button>
            </>
          )}
          <div className={styles.userInfo}>
            <span>{user?.name}</span>
            <button className={styles.logoutBtn} onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </header>

      {/* Background URL input */}
      {showBgInput && (
        <div className={styles.bgInputBar}>
          <input placeholder="URL da imagem de fundo (deixe vazio para remover)" defaultValue={bgImage} onKeyDown={e => e.key === 'Enter' && handleBgSave(e.target.value)} />
          <button className={styles.btnGold} onClick={e => handleBgSave(e.target.previousSibling.value)}>Aplicar</button>
          {bgImage && <button className={styles.btnGhost} onClick={() => handleBgSave('')}>Remover</button>}
        </div>
      )}

      {/* New Card Modal */}
      {showNewCard && (
        <div className={styles.modalOverlay} onClick={() => setShowNewCard(false)}>
          <form className={styles.newCardModal} onClick={e => e.stopPropagation()} onSubmit={handleCreateCard}>
            <div className={styles.ncHeader}>
              <h2>Nova Demanda</h2>
              <button type="button" className={styles.ncClose} onClick={() => setShowNewCard(false)}>✕</button>
            </div>
            <div className={styles.ncBody}>
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Título *</label>
                <input placeholder="Ex: Criativo para campanha de verão" value={newCard.title} onChange={e => setNewCard(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Nome do Expert *</label>
                <input placeholder="Nome do expert / cliente" value={newCard.expert_name} onChange={e => setNewCard(p => ({ ...p, expert_name: e.target.value }))} required />
              </div>
              <div className={styles.ncRow}>
                <div className={styles.ncSection}>
                  <label className={styles.ncLabel}>Tipo de Entrega</label>
                  <select value={newCard.delivery_type} onChange={e => setNewCard(p => ({ ...p, delivery_type: e.target.value }))}>
                    <option value="">Selecione</option>
                    {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className={styles.ncSection}>
                  <label className={styles.ncLabel}>Designer Responsável</label>
                  <select value={newCard.designer_id} onChange={e => setNewCard(p => ({ ...p, designer_id: e.target.value }))}>
                    <option value="">Selecione</option>
                    {designers.filter(d => d.role === 'designer').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Prioridade</label>
                <div className={styles.ncPriority}>
                  {[['normal','Normal'],['alta','Alta'],['urgente','Urgente']].map(([v, l]) => (
                    <button type="button" key={v} className={`${styles.ncPriBtn} ${styles[`ncPri_${v}`]} ${newCard.priority === v ? styles.ncPriActive : ''}`} onClick={() => setNewCard(p => ({ ...p, priority: v }))}>{l}</button>
                  ))}
                </div>
              </div>
              <div className={styles.ncRow}>
                <div className={styles.ncSection}>
                  <label className={styles.ncLabel}>Início</label>
                  <input type="datetime-local" value={newCard.start_date} onChange={e => setNewCard(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div className={styles.ncSection}>
                  <label className={styles.ncLabel}>Deadline</label>
                  <input type="datetime-local" value={newCard.deadline} onChange={e => setNewCard(p => ({ ...p, deadline: e.target.value }))} />
                </div>
                <div className={styles.ncSection}>
                  <label className={styles.ncLabel}>Horas Estimadas</label>
                  <input type="number" step="0.5" min="0" placeholder="0" value={newCard.estimated_hours} onChange={e => setNewCard(p => ({ ...p, estimated_hours: e.target.value }))} />
                </div>
              </div>
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Descrição</label>
                <textarea placeholder="Detalhes da demanda, referências, observações..." value={newCard.description} onChange={e => setNewCard(p => ({ ...p, description: e.target.value }))} rows={4} />
              </div>
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Coluna Inicial</label>
                <select value={newCard.status || 'demanda'} onChange={e => setNewCard(p => ({ ...p, status: e.target.value }))}>
                  {ALL_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>

              {/* Checklist */}
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Checklist</label>
                {(() => {
                  const sections = {};
                  ncChecklist.forEach((item, i) => {
                    const key = item.section || '__none__';
                    if (!sections[key]) sections[key] = [];
                    sections[key].push({ ...item, _idx: i });
                  });
                  const sectionNames = [...new Set(ncChecklist.map(i => i.section).filter(Boolean))];
                  return (
                    <div className={styles.ncCheckWrap}>
                      {Object.entries(sections).map(([key, items]) => (
                        <div key={key} className={styles.ncCheckGroup}>
                          {key !== '__none__' && <span className={styles.ncCheckSectionLabel}>{key}</span>}
                          {items.map(item => (
                            <div key={item._idx} className={styles.ncCheckItem}>
                              <span className={styles.ncCheckDot} />
                              <span>{item.text}</span>
                              <button type="button" className={styles.ncCheckDel} onClick={() => ncRemoveItem(item._idx)}>✕</button>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className={styles.ncCheckAdd}>
                        <select className={styles.ncCheckSelect} value={ncNewSection} onChange={e => setNcNewSection(e.target.value)}>
                          <option value="">Sem setor</option>
                          {sectionNames.map(s => <option key={s} value={s}>{s}</option>)}
                          {ncNewSection && !sectionNames.includes(ncNewSection) && <option value={ncNewSection}>{ncNewSection}</option>}
                        </select>
                        <input placeholder="Novo item..." value={ncNewItem} onChange={e => setNcNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), ncAddItem())} />
                        <button type="button" className={styles.btnGold} onClick={ncAddItem}>+</button>
                      </div>
                      {!ncShowNewSection ? (
                        <button type="button" className={styles.ncAddSectionBtn} onClick={() => setNcShowNewSection(true)}>+ Novo Setor</button>
                      ) : (
                        <div className={styles.ncCheckAdd}>
                          <input placeholder="Nome do setor..." value={ncNewSectionName} onChange={e => setNcNewSectionName(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), ncAddSection())} />
                          <button type="button" className={styles.btnGold} onClick={ncAddSection}>Criar</button>
                          <button type="button" className={styles.ncCheckDel} onClick={() => setNcShowNewSection(false)}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Anexos */}
              <div className={styles.ncSection}>
                <label className={styles.ncLabel}>Anexos</label>
                <div className={styles.ncFilesWrap}>
                  {ncFiles.length > 0 && (
                    <div className={styles.ncFileList}>
                      {ncFiles.map((f, i) => (
                        <div key={i} className={styles.ncFileItem}>
                          <span className={styles.ncFileName}>{f.name}</span>
                          <span className={styles.ncFileSize}>{formatSize(f.size)}</span>
                          <button type="button" className={styles.ncCheckDel} onClick={() => ncRemoveFile(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className={styles.ncUploadBtn}>
                    <input type="file" multiple onChange={ncAddFiles} style={{ display: 'none' }} />
                    <span className={styles.btnGhost}>+ Selecionar Arquivos</span>
                  </label>
                </div>
              </div>
            </div>
            <div className={styles.ncFooter}>
              <button type="button" className={styles.btnGhost} onClick={() => setShowNewCard(false)}>Cancelar</button>
              <button type="submit" className={styles.btnGold}>Criar Demanda</button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Designers */}
      {showManageDesigners && (
        <div className={styles.managePanel}>
          <div className={styles.managePanelHeader}>
            <h3>Gerenciar Designers</h3>
            <button className={styles.logoutBtn} onClick={() => setShowManageDesigners(false)}>✕</button>
          </div>
          <form className={styles.addDesignerForm} onSubmit={handleCreateDesigner}>
            <input placeholder="Nome" value={newDesigner.name} onChange={e => setNewDesigner(p => ({ ...p, name: e.target.value }))} required />
            <input placeholder="Email" type="email" value={newDesigner.email} onChange={e => setNewDesigner(p => ({ ...p, email: e.target.value }))} required />
            <input placeholder="Senha" type="password" value={newDesigner.password} onChange={e => setNewDesigner(p => ({ ...p, password: e.target.value }))} required minLength={6} />
            <button type="submit" className={styles.btnGold}>+ Adicionar</button>
          </form>
          <div className={styles.designerList}>
            {designers.map(d => (
              <div key={d.id} className={styles.designerRow}>
                <span className={styles.designerDot} style={{ background: d.role === 'design_admin' ? '#C9971A' : '#00b894' }} />
                <span className={styles.designerName}>{d.name}</span>
                <span className={styles.designerEmail}>{d.email}</span>
                <span className={styles.designerRole}>{d.role === 'design_admin' ? 'Admin' : 'Editor'}</span>
                {d.role === 'designer' && (
                  <button className={`${styles.toggleBtn} ${d.active === false ? styles.toggleInactive : ''}`} onClick={() => handleToggleDesigner(d.id)}>
                    {d.active === false ? 'Ativar' : 'Desativar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board */}
      <div className={styles.board} style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map(col => (
          <div
            key={col.key}
            className={`${styles.column} ${dragOverCol === col.key ? styles.columnOver : ''}`}
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className={styles.colHeader}>
              <span className={styles.colDot} style={{ background: col.color }} />
              <span className={styles.colTitle}>{col.label}</span>
              <span className={styles.colCount}>{grouped[col.key]?.length || 0}</span>
            </div>
            <div className={styles.colBody}>
              {grouped[col.key]?.map(card => (
                <div
                  key={card.id}
                  className={`${styles.card} ${isOverdue(card) ? styles.cardOverdue : ''} ${styles[`card_${card.priority}`]}`}
                  draggable={canDragCard(card)}
                  onDragStart={e => handleDragStart(e, card)}
                  onClick={() => setSelectedCard(card)}
                >
                  <div className={styles.cardTop}>
                    <span className={`${styles.priBadge} ${styles[`pri_${card.priority}`]}`}>{card.priority}</span>
                    {isOverdue(card) && <span className={styles.overdueBadge}>ATRASADO</span>}
                    {card.delivery_type && <span className={styles.deliveryTag}>{card.delivery_type}</span>}
                  </div>
                  <h4 className={styles.cardTitle}>{card.title}</h4>
                  <p className={styles.cardExpert}>{card.expert_name}</p>
                  <div className={styles.cardMeta}>
                    {card.designer_name && <span className={styles.designerBadge}>{card.designer_name}</span>}
                    {card.deadline && <span className={styles.cardDate}>{formatDt(card.deadline)}</span>}
                    {card.estimated_hours && <span className={styles.cardHours}>{card.estimated_hours}h</span>}
                  </div>
                  {card.checklist_total > 0 && (
                    <div className={styles.checkProgress}>
                      <div className={styles.checkBar}><div className={styles.checkFill} style={{ width: `${(card.checklist_done / card.checklist_total) * 100}%` }} /></div>
                      <span className={styles.checkText}>{card.checklist_done}/{card.checklist_total}</span>
                    </div>
                  )}
                  {card.comments_count > 0 && <span className={styles.commentCount}>{card.comments_count} comentario{card.comments_count > 1 ? 's' : ''}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Card Modal */}
      {selectedCard && (
        <DesignCardModal
          card={selectedCard}
          isAdmin={isDesignAdmin}
          designers={designers}
          onClose={() => setSelectedCard(null)}
          onUpdate={() => { loadCards(); loadMeta(); }}
        />
      )}
    </div>
  );
}
