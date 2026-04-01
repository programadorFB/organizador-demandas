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
  { key: 'analise', label: 'An\u00e1lise', color: '#fdcb6e' },
  { key: 'alteracoes', label: 'Altera\u00e7\u00f5es', color: '#ff6b35' },
  { key: 'concluidas', label: 'Conclu\u00eddas', color: '#00b894' },
  { key: 'pos_gestores', label: 'Mandar P\u00f3s Gestores', color: '#a29bfe' },
  { key: 'reunioes', label: 'Reuni\u00f5es', color: '#fd79a8' },
];

const EDITOR_COLUMNS = ['links', 'demanda', 'em_andamento', 'alteracoes'];
const EDITOR_ALLOWED_MOVES = { demanda: ['em_andamento'], em_andamento: ['analise'], alteracoes: ['analise'] };

const DELIVERY_TYPES = ['Story', 'Post Feed', 'Reels', 'Banner', 'Thumbnail', 'Logo', 'Criativo Ads', 'Carrossel', 'Capa', 'Outro'];

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
  const [showNotifs, setShowNotifs] = useState(false);
  const [bgImage, setBgImage] = useState(() => localStorage.getItem('design_bg') || '');
  const [showBgInput, setShowBgInput] = useState(false);
  const [dragCardStatus, setDragCardStatus] = useState(null);
  const prevCardsRef = useRef([]);
  const [newCard, setNewCard] = useState({ title: '', expert_name: '', delivery_type: '', priority: 'normal', designer_id: '', start_date: '', deadline: '', estimated_hours: '', description: '' });

  const loadCards = useCallback(async () => {
    try {
      const params = {};
      if (filterDesigner) params.designer_id = filterDesigner;
      const list = await designApi.cards(params);

      // Detectar notificacoes comparando com estado anterior
      const prev = prevCardsRef.current;
      if (prev.length > 0) {
        const newNotifs = [];
        list.forEach(c => {
          const old = prev.find(p => p.id === c.id);
          if (!old) return;
          // Card entrou em analise -> notificar admin
          if (old.status !== 'analise' && c.status === 'analise' && isDesignAdmin) {
            newNotifs.push({ id: Date.now() + c.id, text: `"${c.title}" enviado para analise por ${c.designer_name}`, time: new Date(), type: 'analise' });
          }
          // Card entrou em alteracoes -> notificar editor responsavel
          if (old.status !== 'alteracoes' && c.status === 'alteracoes' && !isDesignAdmin && c.designer_id === user?.id) {
            newNotifs.push({ id: Date.now() + c.id, text: `"${c.title}" precisa de alteracoes`, time: new Date(), type: 'alteracoes' });
          }
        });
        if (newNotifs.length > 0) setNotifications(n => [...newNotifs, ...n].slice(0, 50));
      }

      // Detectar cards perto do deadline (24h)
      const now = new Date();
      const deadlineNotifs = list
        .filter(c => c.deadline && c.status !== 'concluidas')
        .filter(c => {
          const dl = new Date(c.deadline);
          const diff = dl - now;
          return diff > 0 && diff < 24 * 60 * 60 * 1000;
        })
        .map(c => ({ id: 'dl_' + c.id, text: `"${c.title}" vence em menos de 24h`, time: new Date(), type: 'deadline' }));

      if (deadlineNotifs.length > 0 && prev.length === 0) {
        setNotifications(n => [...deadlineNotifs, ...n].slice(0, 50));
      }

      prevCardsRef.current = list;
      setCards(list);
    } catch { /* ignore */ }
  }, [filterDesigner, isDesignAdmin, user?.id]);

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
  // Poll a cada 15s para detectar mudancas e notificar
  useEffect(() => {
    const interval = setInterval(loadCards, 15000);
    return () => clearInterval(interval);
  }, [loadCards]);

  const handleBgSave = (url) => {
    setBgImage(url);
    localStorage.setItem('design_bg', url);
    setShowBgInput(false);
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
      await designApi.createCard({
        ...newCard,
        designer_id: newCard.designer_id ? parseInt(newCard.designer_id) : null,
        estimated_hours: newCard.estimated_hours ? parseFloat(newCard.estimated_hours) : null,
        start_date: newCard.start_date || null,
        deadline: newCard.deadline || null,
      });
      setNewCard({ title: '', expert_name: '', delivery_type: '', priority: 'normal', designer_id: '', start_date: '', deadline: '', estimated_hours: '', description: '' });
      setShowNewCard(false);
      loadCards();
      loadMeta();
    } catch (err) { alert(err.message); }
  };

  const handleLogout = () => { logout(); navigate('/design'); };

  const isOverdue = (card) => card.deadline && new Date(card.deadline) < new Date() && card.status !== 'concluidas';

  const formatDt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  const unreadNotifs = notifications.length;
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
            <button className={styles.notifBtn} onClick={() => setShowNotifs(!showNotifs)}>
              <span>🔔</span>
              {unreadNotifs > 0 && <span className={styles.notifBadge}>{unreadNotifs}</span>}
            </button>
            {showNotifs && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifHeader}>
                  <span>Notificacoes</span>
                  {notifications.length > 0 && <button className={styles.notifClear} onClick={() => setNotifications([])}>Limpar</button>}
                </div>
                <div className={styles.notifList}>
                  {notifications.length === 0 && <p className={styles.notifEmpty}>Nenhuma notificacao.</p>}
                  {notifications.map(n => (
                    <div key={n.id} className={`${styles.notifItem} ${styles[`notif_${n.type}`]}`}>
                      <p>{n.text}</p>
                      <span>{n.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
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

      {/* New Card Form */}
      {showNewCard && (
        <form className={styles.newCardForm} onSubmit={handleCreateCard}>
          <input placeholder="Titulo *" value={newCard.title} onChange={e => setNewCard(p => ({ ...p, title: e.target.value }))} required />
          <input placeholder="Nome do Expert *" value={newCard.expert_name} onChange={e => setNewCard(p => ({ ...p, expert_name: e.target.value }))} required />
          <select value={newCard.delivery_type} onChange={e => setNewCard(p => ({ ...p, delivery_type: e.target.value }))}>
            <option value="">Tipo de Entrega</option>
            {DELIVERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={newCard.designer_id} onChange={e => setNewCard(p => ({ ...p, designer_id: e.target.value }))}>
            <option value="">Designer</option>
            {designers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={newCard.priority} onChange={e => setNewCard(p => ({ ...p, priority: e.target.value }))}>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <input type="datetime-local" placeholder="Inicio" value={newCard.start_date} onChange={e => setNewCard(p => ({ ...p, start_date: e.target.value }))} />
          <input type="datetime-local" placeholder="Deadline" value={newCard.deadline} onChange={e => setNewCard(p => ({ ...p, deadline: e.target.value }))} />
          <input type="number" step="0.5" placeholder="Horas estimadas" value={newCard.estimated_hours} onChange={e => setNewCard(p => ({ ...p, estimated_hours: e.target.value }))} />
          <textarea placeholder="Descricao" value={newCard.description} onChange={e => setNewCard(p => ({ ...p, description: e.target.value }))} rows={2} />
          <button type="submit" className={styles.btnGold}>Criar Card</button>
        </form>
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
