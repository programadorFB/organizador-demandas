import { useState, useEffect, useRef, useCallback } from 'react';
import { salesChat, sales } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/SalesChat.module.css';

const COLORS = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#00cec9','#a29bfe','#fab1a0','#74b9ff','#55efc4','#ff7675'];

function getColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

// Renderiza conteúdo com @mentions destacadas
function renderContent(text, currentUserName) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s|$|@|[.,!?;:])/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1).trim();
      const isMentionedMe = currentUserName && name.toLowerCase() === currentUserName.toLowerCase();
      return (
        <span key={i} className={`${styles.mention} ${isMentionedMe ? styles.mentionMe : ''}`}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function SalesChat() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'sales_admin';
  const [messages, setMessages] = useState([]);
  const [pinnedMsgs, setPinnedMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatEnd = useRef(null);
  const lastId = useRef(0);
  const pollRef = useRef(null);

  // Mentions
  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const inputRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await salesChat.messages();
      setMessages(msgs);
      if (msgs.length) lastId.current = msgs[msgs.length - 1].id;
      salesChat.markRead().catch(() => {});
    } catch {}
    finally { setLoading(false); }
  }, []);

  const loadPinned = useCallback(async () => {
    try { setPinnedMsgs(await salesChat.pinned()); } catch {}
  }, []);

  // Carregar membros para mentions
  useEffect(() => {
    sales.sellers().then(s => {
      const list = s.filter(x => x.active !== false).map(x => ({ name: x.name, id: x.id }));
      // Adicionar Sara (admin) se não estiver na lista
      if (!list.find(x => x.name === 'Sara')) list.unshift({ name: 'Sara', id: 0 });
      // Adicionar "Todas" para mencionar todo mundo
      list.unshift({ name: 'Todas', id: -1 });
      setMembers(list);
    }).catch(() => {});
  }, []);

  // Polling para novas mensagens
  useEffect(() => {
    loadMessages();
    loadPinned();
    pollRef.current = setInterval(async () => {
      if (!lastId.current) return;
      try {
        const newMsgs = await salesChat.newMessages(lastId.current);
        if (newMsgs.length) {
          setMessages(prev => [...prev, ...newMsgs]);
          lastId.current = newMsgs[newMsgs.length - 1].id;
          salesChat.markRead().catch(() => {});
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages, loadPinned]);

  // Auto-scroll
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (editing) {
      await salesChat.edit(editing.id, input);
      setEditing(null);
      setInput('');
      loadMessages();
      return;
    }
    try {
      const msg = await salesChat.send(input, replyTo?.id);
      setMessages(prev => [...prev, msg]);
      lastId.current = msg.id;
      setInput('');
      setReplyTo(null);
    } catch {}
  };

  // Lógica de @mentions no input
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // Detectar se está digitando uma @mention
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].toLowerCase());
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.name.toLowerCase().includes(mentionQuery))
    : [];

  const insertMention = (name) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    const newText = textBefore.slice(0, atIdx) + `@${name} ` + textAfter;
    setInput(newText);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Navegar dropdown de mentions
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIdx].name); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') { setReplyTo(null); setEditing(null); setInput(''); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Apagar mensagem?')) return;
    await salesChat.remove(id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handlePin = async (id) => {
    await salesChat.pin(id);
    loadMessages();
    loadPinned();
  };

  const startEdit = (msg) => {
    setEditing(msg);
    setInput(msg.content);
    setReplyTo(null);
  };

  const fmtTime = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

  // Agrupar mensagens por dia
  let lastDate = '';

  if (loading) return <div className={styles.loadWrap}><div className={styles.spinner} /></div>;

  return (
    <div className={styles.chatWrap}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <div>
          <h3 className={styles.chatTitle}>Chat da Equipe</h3>
          <span className={styles.chatSub}>{messages.length} mensagens</span>
        </div>
        <button className={`${styles.pinBtn} ${showPinned ? styles.pinBtnActive : ''}`} onClick={() => setShowPinned(!showPinned)}>
          Fixadas ({pinnedMsgs.length})
        </button>
      </div>

      {/* Pinned panel */}
      {showPinned && pinnedMsgs.length > 0 && (
        <div className={styles.pinnedPanel}>
          {pinnedMsgs.map(m => (
            <div key={m.id} className={styles.pinnedItem}>
              <span className={styles.pinnedAuthor}>{m.user_name}:</span>
              <span className={styles.pinnedText}>{m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className={styles.messagesArea}>
        {messages.map((m) => {
          const dateStr = fmtDate(m.created_at);
          let showDate = false;
          if (dateStr !== lastDate) { showDate = true; lastDate = dateStr; }
          const isMine = m.user_id === user.id;

          return (
            <div key={m.id}>
              {showDate && <div className={styles.dateDivider}><span>{dateStr}</span></div>}
              <div className={`${styles.msgRow} ${isMine ? styles.msgMine : ''}`}>
                {!isMine && (
                  <div className={styles.msgAvatar} style={{ background: getColor(m.user_name) }}>
                    {m.user_name?.charAt(0)}
                  </div>
                )}
                <div className={`${styles.msgBubble} ${isMine ? styles.bubbleMine : ''}`}>
                  {!isMine && <div className={styles.msgAuthor} style={{ color: getColor(m.user_name) }}>{m.user_name}</div>}
                  {m.reply_content && (
                    <div className={styles.replyQuote}>
                      <span className={styles.replyName}>{m.reply_user_name}</span>
                      <span className={styles.replyText}>{m.reply_content.length > 60 ? m.reply_content.slice(0, 60) + '...' : m.reply_content}</span>
                    </div>
                  )}
                  <div className={styles.msgContent}>{renderContent(m.content, user.name)}</div>
                  <div className={styles.msgMeta}>
                    <span className={styles.msgTime}>{fmtTime(m.created_at)}</span>
                    {m.edited && <span className={styles.editedTag}>editada</span>}
                    {m.pinned && <span className={styles.pinnedTag}>fixada</span>}
                  </div>
                  {/* Actions */}
                  <div className={styles.msgActions}>
                    <button onClick={() => { setReplyTo(m); setEditing(null); }} title="Responder">&#8617;</button>
                    {isMine && <button onClick={() => startEdit(m)} title="Editar">&#9998;</button>}
                    {(isMine || isAdmin) && <button onClick={() => handleDelete(m.id)} title="Apagar">&#10005;</button>}
                    {isAdmin && <button onClick={() => handlePin(m.id)} title={m.pinned ? 'Desfixar' : 'Fixar'}>{m.pinned ? '&#9733;' : '&#9734;'}</button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className={styles.empty}>Nenhuma mensagem ainda. Comece a conversa!</div>}
        <div ref={chatEnd} />
      </div>

      {/* Reply/Edit indicator */}
      {(replyTo || editing) && (
        <div className={styles.replyBar}>
          <span>{editing ? 'Editando mensagem' : `Respondendo ${replyTo.user_name}`}</span>
          <button onClick={() => { setReplyTo(null); setEditing(null); setInput(''); }}>&#10005;</button>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputBar}>
        <div className={styles.inputWrap}>
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div className={styles.mentionDropdown}>
              {filteredMembers.map((m, i) => (
                <div
                  key={m.id}
                  className={`${styles.mentionOption} ${i === mentionIdx ? styles.mentionActive : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
                  onMouseEnter={() => setMentionIdx(i)}
                >
                  <span className={styles.mentionDot} style={{ background: getColor(m.name) }}>{m.name.charAt(0)}</span>
                  <span>@{m.name}</span>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... Use @ para mencionar"
            rows={1}
            className={styles.chatInput}
          />
        </div>
        <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}
