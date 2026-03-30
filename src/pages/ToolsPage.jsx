import { useState, useEffect } from 'react';
import { tools as toolsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/ToolsPage.module.css';

const CYCLES = [
  { value: 'gratuito', label: 'Gratuito' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'unico', label: 'Pagamento Único' },
];

const CATEGORIES = ['Hosting', 'SaaS', 'API', 'Domínio', 'Monitoramento', 'DevTools', 'Marketing', 'Outros'];

const EMPTY = { name: '', description: '', url: '', cost: '', currency: 'BRL', billing_cycle: 'mensal', next_payment_date: '', category: 'SaaS' };

export default function ToolsPage() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    toolsApi.list().then(setList).catch(() => {});
    toolsApi.summary().then(setSummary).catch(() => {});
  };

  useEffect(load, []);

  const set = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, cost: parseFloat(form.cost) || 0 };
    if (editing) {
      await toolsApi.update(editing, payload);
    } else {
      await toolsApi.create(payload);
    }
    setForm(EMPTY);
    setEditing(null);
    setShowForm(false);
    load();
  };

  const handleEdit = (t) => {
    setForm({
      name: t.name, description: t.description || '', url: t.url || '',
      cost: t.cost || '', currency: t.currency, billing_cycle: t.billing_cycle,
      next_payment_date: t.next_payment_date ? t.next_payment_date.split('T')[0] : '',
      category: t.category || 'SaaS', active: t.active
    });
    setEditing(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta ferramenta?')) return;
    await toolsApi.delete(id);
    load();
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const formatMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`;

  const daysUntil = (d) => {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.topBar}>
          <h1>Ferramentas & Assinaturas</h1>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null); setForm(EMPTY); }}>
              {showForm ? 'Cancelar' : '+ Nova Ferramenta'}
            </button>
          )}
        </div>

        {summary && (
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Custo Mensal</span>
              <span className={styles.summaryValue}>{formatMoney(summary.monthlyTotal)}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Pagamentos Próximos (7d)</span>
              <span className={`${styles.summaryValue} ${summary.upcomingPayments > 0 ? styles.warn : ''}`}>
                {summary.upcomingPayments}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Atrasados</span>
              <span className={`${styles.summaryValue} ${summary.overduePayments > 0 ? styles.danger : ''}`}>
                {summary.overduePayments}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Ativas</span>
              <span className={styles.summaryValue}>{list.filter(t => t.active).length}</span>
            </div>
          </div>
        )}

        {showForm && (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Nome *</label>
                <input value={form.name} onChange={set('name')} placeholder="Ex: Cloudflare, Vercel, Render..." required />
              </div>
              <div className={styles.field}>
                <label>Categoria</label>
                <select value={form.category} onChange={set('category')}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Custo (R$)</label>
                <input type="number" step="0.01" value={form.cost} onChange={set('cost')} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label>Ciclo</label>
                <select value={form.billing_cycle} onChange={set('billing_cycle')}>
                  {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Próximo Pagamento</label>
                <input type="date" value={form.next_payment_date} onChange={set('next_payment_date')} />
              </div>
              <div className={styles.field}>
                <label>URL</label>
                <input value={form.url} onChange={set('url')} placeholder="https://..." />
              </div>
            </div>
            <div className={styles.field}>
              <label>Descrição</label>
              <textarea value={form.description} onChange={set('description')} placeholder="Para que serve..." rows={2} />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary">{editing ? 'Atualizar' : 'Adicionar'}</button>
            </div>
          </form>
        )}

        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span>Ferramenta</span>
            <span>Categoria</span>
            <span>Custo</span>
            <span>Ciclo</span>
            <span>Próx. Pagamento</span>
            <span>Ações</span>
          </div>
          {list.map(t => {
            const days = daysUntil(t.next_payment_date);
            const isOverdue = days !== null && days < 0;
            const isUpcoming = days !== null && days >= 0 && days <= 7;
            return (
              <div key={t.id} className={`${styles.tableRow} ${!t.active ? styles.inactive : ''}`}>
                <div className={styles.toolName}>
                  <strong>{t.name}</strong>
                  {t.url && <a href={t.url} target="_blank" rel="noreferrer" className={styles.toolUrl}>abrir</a>}
                  {t.description && <span className={styles.toolDesc}>{t.description}</span>}
                </div>
                <span className={styles.catBadge}>{t.category}</span>
                <span className={styles.cost}>{t.billing_cycle === 'gratuito' ? 'Grátis' : formatMoney(t.cost)}</span>
                <span>{CYCLES.find(c => c.value === t.billing_cycle)?.label}</span>
                <span className={`${styles.payDate} ${isOverdue ? styles.overdue : ''} ${isUpcoming ? styles.upcoming : ''}`}>
                  {t.next_payment_date ? (
                    <>
                      {formatDate(t.next_payment_date)}
                      {isOverdue && <small> ({Math.abs(days)}d atrasado)</small>}
                      {isUpcoming && <small> (em {days}d)</small>}
                    </>
                  ) : '—'}
                </span>
                {isAdmin && (
                  <div className={styles.actions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>×</button>
                  </div>
                )}
              </div>
            );
          })}
          {list.length === 0 && <div className={styles.empty}>Nenhuma ferramenta cadastrada.</div>}
        </div>
      </div>
    </div>
  );
}
