import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import styles from '../styles/DesignSelect.module.css';

const PROFILES = [
  { name: 'Pepo', role: 'Admin', email: 'pepo@fuzabalta.com', initials: 'PP' },
  { name: 'GS', role: 'Editor', email: 'gs@fuzabalta.com', initials: 'GS' },
  { name: 'MW', role: 'Editor', email: 'mw@fuzabalta.com', initials: 'MW' },
  { name: 'Arthur', role: 'Editor', email: 'arthur@fuzabalta.com', initials: 'AR' },
];

export default function DesignSelectPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && ['designer', 'design_admin', 'admin'].includes(user.role)) {
      navigate('/design/board', { replace: true });
    }
  }, [user, navigate]);

  const handleSelect = (profile) => {
    setSelected(profile);
    setPassword('');
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(selected.email, password);
      navigate('/design/board');
    } catch {
      setError('Senha incorreta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.brand}>
          <h1>FUZABALTA</h1>
          <p>Design Board</p>
        </div>

        <div className={styles.profileGrid}>
          {PROFILES.map(p => (
            <button
              key={p.email}
              className={`${styles.profileCard} ${selected?.email === p.email ? styles.profileActive : ''}`}
              onClick={() => handleSelect(p)}
            >
              <div className={styles.avatar}>{p.initials}</div>
              <span className={styles.profileName}>{p.name}</span>
              <span className={styles.profileRole}>{p.role}</span>
            </button>
          ))}
        </div>

        {selected && (
          <form className={styles.loginForm} onSubmit={handleLogin}>
            <p className={styles.loginLabel}>Entrar como <strong>{selected.name}</strong></p>
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              required
            />
            {error && <span className={styles.error}>{error}</span>}
            <button type="submit" className={styles.loginBtn} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
