import { useState } from 'react';
import { demands as demandsApi, attachments as attachApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/FormPage.module.css';

const CATEGORIES = [
  { value: 'feature', label: 'Nova Feature' },
  { value: 'bug', label: 'Bug / Correção' },
  { value: 'melhoria', label: 'Melhoria' },
  { value: 'tarefa_tecnica', label: 'Tarefa Técnica' },
  { value: 'documentacao', label: 'Documentação' },
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', desc: 'Pode esperar, sem impacto imediato' },
  { value: 'media', label: 'Média', desc: 'Importante mas não bloqueia nada' },
  { value: 'alta', label: 'Alta', desc: 'Impacto significativo, priorizar' },
  { value: 'urgente', label: 'Urgente', desc: 'Crítico — precisa de aprovação do admin' },
];

const STORY_POINTS = [1, 2, 3, 5, 8, 13, 21];

const INITIAL = { title: '', description: '', category: 'feature', priority: 'media', story_points: '', acceptance_criteria: '', due_date: '' };

export default function FormPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleFiles = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    e.target.value = '';
  };
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const demand = await demandsApi.create({
        ...form,
        story_points: form.story_points ? parseInt(form.story_points) : null,
        due_date: form.due_date || null,
      });
      if (files.length > 0) {
        await attachApi.upload(demand.id, files);
      }
      setSuccess(true);
      setForm(INITIAL);
      setFiles([]);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.heading}>
          <h1>Nova Demanda</h1>
          <p>Preencha os detalhes da demanda. Ela entrará na fila automaticamente.</p>
        </div>

        <div className={styles.waitNotice}>
          <strong>Prazo estimado:</strong> O tempo mínimo de espera para atendimento de qualquer demanda é de <strong>pelo menos 2 semanas</strong>, a partir da data de envio. Demandas urgentes aprovadas podem ter prioridade, mas não garantem redução deste prazo.
        </div>

        {success && (
          <div className={styles.successBanner}>
            Demanda enviada com sucesso! Ela foi adicionada à fila de prioridades. O prazo mínimo estimado de atendimento é de pelo menos 2 semanas.
            {form.priority === 'urgente' && ' O administrador será notificado para aprovar a urgência.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <div className={styles.section}>
            <h2>Informações Básicas</h2>
            <div className={styles.field}>
              <label>Título da Demanda *</label>
              <input type="text" value={form.title} onChange={set('title')} placeholder="Ex: Implementar login social com Google" required />
            </div>
            <div className={styles.field}>
              <label>Descrição Detalhada *</label>
              <textarea value={form.description} onChange={set('description')} placeholder="Descreva o que precisa ser feito, o contexto e o objetivo..." rows={4} required />
            </div>
          </div>

          <div className={styles.section}>
            <h2>Classificação</h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Categoria *</label>
                <select value={form.category} onChange={set('category')}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Story Points</label>
                <select value={form.story_points} onChange={set('story_points')}>
                  <option value="">Não estimado</option>
                  {STORY_POINTS.map(sp => <option key={sp} value={sp}>{sp} {sp === 1 ? 'ponto' : 'pontos'}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2>Prioridade</h2>
            <div className={styles.priorityGrid}>
              {PRIORITIES.map(p => (
                <label key={p.value} className={`${styles.priorityOption} ${form.priority === p.value ? styles.prioritySelected : ''} ${styles[`priority_${p.value}`]}`}>
                  <input type="radio" name="priority" value={p.value} checked={form.priority === p.value} onChange={set('priority')} />
                  <span className={styles.priorityLabel}>{p.label}</span>
                  <span className={styles.priorityDesc}>{p.desc}</span>
                </label>
              ))}
            </div>
            {form.priority === 'urgente' && (
              <div className={styles.urgentWarning}>
                Demandas urgentes precisam ser aprovadas pelo administrador antes de furar a fila.
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h2>Detalhes Adicionais</h2>
            <div className={styles.field}>
              <label>Critérios de Aceitação</label>
              <textarea value={form.acceptance_criteria} onChange={set('acceptance_criteria')} placeholder="O que define que essa demanda está concluída? Liste os critérios..." rows={3} />
            </div>
            <div className={styles.field} style={{ maxWidth: 250 }}>
              <label>Data Desejada de Entrega</label>
              <input type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>

          <div className={styles.section}>
            <h2>Anexos</h2>
            <div className={styles.field}>
              <label>Arquivos (imagens, PDFs, vídeos, documentos — máx 50MB cada)</label>
              <div className={styles.uploadArea}>
                <label className={styles.uploadBtn}>
                  <input type="file" multiple onChange={handleFiles} style={{ display: 'none' }} />
                  <span className="btn btn-ghost btn-sm">+ Selecionar Arquivos</span>
                </label>
                {files.length > 0 && (
                  <div className={styles.fileList}>
                    {files.map((f, i) => (
                      <div key={i} className={styles.fileItem}>
                        <span className={styles.fileName}>{f.name}</span>
                        <span className={styles.fileSize}>{formatSize(f.size)}</span>
                        <button type="button" className={styles.fileRemove} onClick={() => removeFile(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Demanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
