import { useState, useEffect } from 'react';
import { dashboards as dashApi } from '../services/api';
import styles from '../styles/DashboardsPage.module.css';

const TYPE_CONFIG = {
  grafana: { color: '#FF6B00', label: 'Grafana' },
  prometheus: { color: '#E6522C', label: 'Prometheus' },
  app: { color: '#6c5ce7', label: 'App' },
  api: { color: '#00b894', label: 'API' },
  tunnel: { color: '#0984e3', label: 'Tunnel' },
  database: { color: '#fdcb6e', label: 'Database' },
  custom: { color: '#636e72', label: 'Custom' },
};

export default function DashboardsPage() {
  const [dashList, setDash] = useState([]);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboards');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      dashApi.list().catch(() => []),
      dashApi.containers().catch(() => []),
    ]).then(([d, c]) => {
      setDash(d);
      setContainers(c);
      setLoading(false);
    });
  }, []);

  const refreshContainers = () => {
    dashApi.containers().then(setContainers).catch(() => {});
  };

  const grouped = {};
  dashList.forEach(d => {
    const type = d.type || 'custom';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(d);
  });

  const filteredContainers = filter
    ? containers.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
    : containers;

  const healthyCount = containers.filter(c => c.healthy).length;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.topBar}>
          <h1>Infraestrutura</h1>
          <div className={styles.healthSummary}>
            <span className={styles.healthDot} style={{ background: healthyCount === containers.length ? 'var(--accent-green)' : 'var(--priority-media)' }} />
            <span>{healthyCount}/{containers.length} containers saudáveis</span>
          </div>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'dashboards' ? styles.activeTab : ''}`} onClick={() => setTab('dashboards')}>
            Dashboards & Serviços ({dashList.length})
          </button>
          <button className={`${styles.tab} ${tab === 'containers' ? styles.activeTab : ''}`} onClick={() => setTab('containers')}>
            Containers Docker ({containers.length})
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Carregando infraestrutura...</div>
        ) : tab === 'dashboards' ? (
          <div className={styles.dashSection}>
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupDot} style={{ background: TYPE_CONFIG[type]?.color }} />
                  <h2>{TYPE_CONFIG[type]?.label || type}</h2>
                  <span className={styles.groupCount}>{items.length}</span>
                </div>
                <div className={styles.grid}>
                  {items.map(d => (
                    <div key={d.id} className={styles.dashCard}>
                      <div className={styles.dashTop}>
                        <span className={styles.typeBadge} style={{ background: `${TYPE_CONFIG[d.type]?.color}20`, color: TYPE_CONFIG[d.type]?.color }}>
                          {TYPE_CONFIG[d.type]?.label}
                        </span>
                        {d.port && <span className={styles.port}>:{d.port}</span>}
                      </div>
                      <h3>{d.name}</h3>
                      {d.description && <p className={styles.dashDesc}>{d.description}</p>}
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noreferrer" className={styles.dashLink}>
                          Abrir Dashboard →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.containerSection}>
            <div className={styles.containerToolbar}>
              <input
                placeholder="Filtrar containers..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className={styles.filterInput}
              />
              <button className="btn btn-ghost btn-sm" onClick={refreshContainers}>Atualizar</button>
            </div>
            <div className={styles.containerGrid}>
              {filteredContainers.map((c, i) => (
                <div key={i} className={`${styles.containerCard} ${c.healthy ? styles.healthy : styles.unhealthy}`}>
                  <div className={styles.containerTop}>
                    <span className={`${styles.statusDot} ${c.healthy ? styles.dotHealthy : styles.dotUnhealthy}`} />
                    <strong>{c.name}</strong>
                  </div>
                  <div className={styles.containerMeta}>
                    <span className={styles.containerStatus}>{c.status}</span>
                    <span className={styles.containerImage}>{c.image?.split(':')[0]?.split('/').pop()}</span>
                  </div>
                  {c.ports && <span className={styles.containerPorts}>{c.ports}</span>}
                </div>
              ))}
              {filteredContainers.length === 0 && <div className={styles.empty}>Nenhum container encontrado.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
