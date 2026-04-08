import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

const previewColors = {
  dark: ['#08080d', '#0e0e16', '#6c5ce7'],
  midnight: ['#0a0e1a', '#101829', '#5b8def'],
  emerald: ['#060d0a', '#0b1610', '#10b981'],
  rose: ['#100a0c', '#180e12', '#e17055'],
  light: ['#f5f5f8', '#ffffff', '#6c5ce7'],
};

export default function ThemeSettings() {
  const { themeId, bgId, customBgUrl, bgOpacity, themes, backgrounds, changeTheme, changeBg, changeCustomBg, changeOpacity } = useTheme();
  const [urlInput, setUrlInput] = useState(customBgUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Esquema de Cores */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Esquema de Cores</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem' }}>
          {Object.entries(themes).map(([id, theme]) => (
            <button
              key={id}
              onClick={() => changeTheme(id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                padding: '0.8rem', borderRadius: 'var(--radius-sm)',
                border: themeId === id ? '2px solid var(--accent-purple)' : '1px solid var(--border)',
                background: themeId === id ? 'rgba(108,92,231,0.08)' : 'var(--bg-card)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                {(previewColors[id] || ['#333', '#444', '#6c5ce7']).map((c, i) => (
                  <div key={i} style={{
                    width: i === 2 ? '14px' : '18px', height: '24px',
                    borderRadius: '4px', background: c,
                    border: id === 'light' ? '1px solid #ccc' : 'none',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: themeId === id ? 'var(--accent-purple)' : 'var(--text-secondary)' }}>
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Plano de Fundo */}
      <div>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Plano de Fundo</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
          {Object.entries(backgrounds).map(([id, bg]) => (
            <button
              key={id}
              onClick={() => changeBg(id)}
              style={{
                padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)',
                border: bgId === id ? '2px solid var(--accent-purple)' : '1px solid var(--border)',
                background: bgId === id ? 'rgba(108,92,231,0.08)' : 'var(--bg-card)',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                color: bgId === id ? 'var(--accent-purple)' : 'var(--text-secondary)',
              }}
            >
              {bg.name}
            </button>
          ))}
          <button
            onClick={() => changeBg('custom')}
            style={{
              padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)',
              border: bgId === 'custom' ? '2px solid var(--accent-purple)' : '1px solid var(--border)',
              background: bgId === 'custom' ? 'rgba(108,92,231,0.08)' : 'var(--bg-card)',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
              color: bgId === 'custom' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            }}
          >
            Imagem Custom
          </button>
        </div>
      </div>

      {/* URL de imagem customizada */}
      {bgId === 'custom' && (
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            URL da imagem de fundo
          </label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => changeCustomBg(urlInput)}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Opacidade do fundo */}
      {bgId !== 'none' && (
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
            Opacidade do fundo: {Math.round(bgOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={bgOpacity}
            onChange={e => changeOpacity(parseFloat(e.target.value))}
            style={{
              width: '100%', height: 'auto', padding: 0, border: 'none',
              background: 'transparent', cursor: 'pointer',
              accentColor: 'var(--accent-purple)',
            }}
          />
        </div>
      )}
    </div>
  );
}
