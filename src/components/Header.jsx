import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import { demands as demandsApi } from '../services/api';
import styles from '../styles/Header.module.css';

export default function Header() {
  const { user, logout, isAdmin, canManage } = useAuth();
  const navigate = useNavigate();
  const [urgentCount, setUrgentCount] = useState(0);

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
            <NavLink to="/design/board" className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
              Design Board
            </NavLink>
          )}
        </nav>
      </div>
      <div className={styles.right}>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userRole}>{user.role}</span>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>Sair</button>
      </div>
    </header>
  );
}
