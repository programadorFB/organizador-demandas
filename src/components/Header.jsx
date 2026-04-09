import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import { demands as demandsApi } from '../services/api';
import ThemeSettings from './ThemeSettings';
import styles from '../styles/Header.module.css';

export default function Header() {
  const { user, logout, isAdmin, canManage } = useAuth();
  const navigate = useNavigate();
  const [urgentCount, setUrgentCount] = useState(0);
  const [showTheme, setShowTheme] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    demandsApi.urgentPending().then(list => setUrgentCount(list.length)).catch(() => {});
    const interval = setInterval(() => {
      demandsApi.urgentPending().then(list => setUrgentCount(list.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [canManage]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>Demandas</span>
        </div>
        <nav className={styles.nav}>
          <NavLink to="/nova-demanda" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
            + Nova Demanda
          </NavLink>
          {user.role === 'user' && (
            <NavLink to="/minhas-demandas" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Minhas Demandas
            </NavLink>
          )}
          {canManage && (
            <>
              <NavLink to="/board" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                Board
                {!isAdmin && urgentCount > 0 && <span className={styles.badge}>{urgentCount}</span>}
              </NavLink>
              <NavLink to="/scrum" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                Scrum
              </NavLink>
              <NavLink to="/infraestrutura" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                Infra
              </NavLink>
            </>
          )}
          {canManage && (
            <NavLink to="/ferramentas" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Ferramentas
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Admin
              {urgentCount > 0 && <span className={styles.badge}>{urgentCount}</span>}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin-demandas" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Central Demandas
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/design/board" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Design Board
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/vendas" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Vendas
            </NavLink>
          )}
        </nav>
      </div>
      <div className={styles.right}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTheme(!showTheme)}
            className={styles.logoutBtn}
            style={{ marginRight: '0.5rem', fontSize: '0.9rem' }}
            title="Aparencia"
          >
            &#9790;
          </button>
          {showTheme && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowTheme(false)} />
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                width: '380px', maxHeight: '80vh', overflowY: 'auto',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '1.2rem',
                boxShadow: 'var(--shadow-lg)', zIndex: 999,
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Aparencia</h3>
                <ThemeSettings />
              </div>
            </>
          )}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
      </div>
    </header>
  );
}
