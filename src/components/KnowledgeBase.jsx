import { useState, useEffect, useCallback } from 'react';
import { knowledge } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/KnowledgeBase.module.css';

export default function KnowledgeBase() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'sales_admin';
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category_id: '', pinned: false });
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', color: '#6c5ce7' });
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    try { setCategories(await knowledge.categories()); } catch {}
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      const params = {};
      if (selectedCat) params.category_id = selectedCat;
      if (search) params.search = search;
      setArticles(await knowledge.articles(params));
    } catch {}
  }, [selectedCat, search]);

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const openArticle = async (id) => {
    try {
      const a = await knowledge.article(id);
      setSelectedArticle(a);
    } catch {}
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    try {
      if (editingArticle) {
        await knowledge.updateArticle(editingArticle.id, form);
      } else {
        await knowledge.createArticle(form);
      }
      setShowEditor(false);
      setEditingArticle(null);
      setForm({ title: '', content: '', category_id: '', pinned: false });
      loadArticles();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteArticle = async (id) => {
    if (!confirm('Excluir artigo?')) return;
    await knowledge.deleteArticle(id);
    setSelectedArticle(null);
    loadArticles();
  };

  const startEdit = (article) => {
    setForm({
      title: article.title,
      content: article.content,
      category_id: article.category_id || '',
      pinned: article.pinned,
    });
    setEditingArticle(article);
    setShowEditor(true);
    setSelectedArticle(null);
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    try {
      await knowledge.createCategory(catForm);
      setShowCatForm(false);
      setCatForm({ name: '', color: '#6c5ce7' });
      loadCategories();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteCat = async (id) => {
    if (!confirm('Excluir categoria?')) return;
    await knowledge.deleteCategory(id);
    if (selectedCat === id) setSelectedCat(null);
    loadCategories();
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR');

  if (loading) return <div className={styles.loadWrap}><div className={styles.spinner} /></div>;

  // Artigo aberto
  if (selectedArticle) return (
    <div className={styles.wrap}>
      <button className={styles.backBtn} onClick={() => setSelectedArticle(null)}>&larr; Voltar</button>
      <article className={styles.articleView}>
        <div className={styles.articleHeader}>
          {selectedArticle.category_name && (
            <span className={styles.articleCatBadge} style={{ background: selectedArticle.category_color + '20', color: selectedArticle.category_color }}>
              {selectedArticle.category_name}
            </span>
          )}
          {selectedArticle.pinned && <span className={styles.pinnedBadge}>Fixado</span>}
        </div>
        <h2 className={styles.articleTitle}>{selectedArticle.title}</h2>
        <div className={styles.articleMeta}>
          <span>Por {selectedArticle.author_name}</span>
          <span>{fmtDate(selectedArticle.updated_at)}</span>
          <span>{selectedArticle.views} visualizacoes</span>
        </div>
        <div className={styles.articleBody}>{selectedArticle.content}</div>
        {isAdmin && (
          <div className={styles.articleActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(selectedArticle)}>Editar</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteArticle(selectedArticle.id)}>Excluir</button>
          </div>
        )}
      </article>
    </div>
  );

  // Editor
  if (showEditor) return (
    <div className={styles.wrap}>
      <button className={styles.backBtn} onClick={() => { setShowEditor(false); setEditingArticle(null); }}>&larr; Voltar</button>
      <div className={styles.editorBox}>
        <h3>{editingArticle ? 'Editar Artigo' : 'Novo Artigo'}</h3>
        <form onSubmit={handleSaveArticle}>
          <div className={styles.ff}>
            <label>Titulo</label>
            <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
          </div>
          <div className={styles.ffRow}>
            <div className={styles.ff}>
              <label>Categoria</label>
              <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.ff}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ width: 'auto' }} />
                Fixar no topo
              </label>
            </div>
          </div>
          <div className={styles.ff}>
            <label>Conteudo</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={12} required />
          </div>
          <div className={styles.editorActions}>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowEditor(false); setEditingArticle(null); }}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editingArticle ? 'Salvar' : 'Publicar'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  // Lista
  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h2 className={styles.kbTitle}>Banco de Conhecimento</h2>
        {isAdmin && (
          <div className={styles.topActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCatForm(!showCatForm)}>+ Categoria</button>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm({ title: '', content: '', category_id: '', pinned: false }); setEditingArticle(null); setShowEditor(true); }}>+ Novo Artigo</button>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className={styles.searchBar}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar artigos..." className={styles.searchInput} />
      </div>

      {/* Form categoria */}
      {showCatForm && (
        <form onSubmit={handleSaveCat} className={styles.catForm}>
          <input type="text" value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da categoria" required />
          <input type="color" value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color: e.target.value }))} className={styles.colorPicker} />
          <button type="submit" className="btn btn-primary btn-sm">Criar</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCatForm(false)}>Cancelar</button>
        </form>
      )}

      {/* Categorias */}
      <div className={styles.catList}>
        <button className={`${styles.catBtn} ${!selectedCat ? styles.catActive : ''}`} onClick={() => setSelectedCat(null)}>
          Todos ({articles.length})
        </button>
        {categories.map(c => (
          <div key={c.id} className={styles.catBtnWrap}>
            <button
              className={`${styles.catBtn} ${selectedCat === c.id ? styles.catActive : ''}`}
              style={{ borderColor: selectedCat === c.id ? c.color : 'transparent', color: selectedCat === c.id ? c.color : undefined }}
              onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
            >
              {c.name} ({c.article_count})
            </button>
            {isAdmin && <button className={styles.catDelete} onClick={() => handleDeleteCat(c.id)} title="Excluir">&times;</button>}
          </div>
        ))}
      </div>

      {/* Artigos */}
      <div className={styles.articleGrid}>
        {articles.map(a => (
          <div key={a.id} className={styles.articleCard} onClick={() => openArticle(a.id)}>
            <div className={styles.cardTop}>
              {a.category_name && (
                <span className={styles.cardCat} style={{ background: (a.category_color || '#6c5ce7') + '20', color: a.category_color }}>
                  {a.category_name}
                </span>
              )}
              {a.pinned && <span className={styles.cardPin}>Fixado</span>}
            </div>
            <h4 className={styles.cardTitle}>{a.title}</h4>
            <p className={styles.cardPreview}>{a.content.length > 120 ? a.content.slice(0, 120) + '...' : a.content}</p>
            <div className={styles.cardMeta}>
              <span>{a.author_name}</span>
              <span>{fmtDate(a.updated_at)}</span>
              <span>{a.views} views</span>
            </div>
          </div>
        ))}
        {articles.length === 0 && <div className={styles.empty}>Nenhum artigo encontrado.</div>}
      </div>
    </div>
  );
}
