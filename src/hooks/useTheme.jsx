import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Esquemas de Cores ───
const THEMES = {
  dark: {
    name: 'Escuro Padrao',
    vars: {
      '--bg-primary': '#08080d',
      '--bg-secondary': '#0e0e16',
      '--bg-card': '#14141f',
      '--bg-card-hover': '#1a1a28',
      '--bg-surface': '#1c1c2e',
      '--bg-input': '#12121c',
      '--border': '#2a2a3e',
      '--border-light': '#353550',
      '--text-primary': '#e8e8f0',
      '--text-secondary': '#8888a0',
      '--text-muted': '#555570',
      '--accent-purple': '#6c5ce7',
      '--accent-purple-hover': '#7d6ff0',
      '--accent-cyan': '#00d2d3',
      '--accent-green': '#00b894',
      '--shadow': '0 4px 24px rgba(0,0,0,0.4)',
      '--shadow-lg': '0 8px 40px rgba(0,0,0,0.6)',
    },
  },
  midnight: {
    name: 'Midnight Blue',
    vars: {
      '--bg-primary': '#0a0e1a',
      '--bg-secondary': '#101829',
      '--bg-card': '#162035',
      '--bg-card-hover': '#1c2840',
      '--bg-surface': '#1e2d48',
      '--bg-input': '#0f1724',
      '--border': '#243352',
      '--border-light': '#2e4068',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#8899b0',
      '--text-muted': '#506080',
      '--accent-purple': '#5b8def',
      '--accent-purple-hover': '#6e9df5',
      '--accent-cyan': '#38bdf8',
      '--accent-green': '#34d399',
      '--shadow': '0 4px 24px rgba(0,0,0,0.5)',
      '--shadow-lg': '0 8px 40px rgba(0,0,0,0.7)',
    },
  },
  emerald: {
    name: 'Emerald Dark',
    vars: {
      '--bg-primary': '#060d0a',
      '--bg-secondary': '#0b1610',
      '--bg-card': '#112018',
      '--bg-card-hover': '#17291f',
      '--bg-surface': '#1a3024',
      '--bg-input': '#0a1410',
      '--border': '#1e3a2a',
      '--border-light': '#2a4d38',
      '--text-primary': '#e0f0e8',
      '--text-secondary': '#80a890',
      '--text-muted': '#4a7058',
      '--accent-purple': '#10b981',
      '--accent-purple-hover': '#34d399',
      '--accent-cyan': '#2dd4bf',
      '--accent-green': '#22c55e',
      '--shadow': '0 4px 24px rgba(0,0,0,0.45)',
      '--shadow-lg': '0 8px 40px rgba(0,0,0,0.65)',
    },
  },
  rose: {
    name: 'Rose Gold',
    vars: {
      '--bg-primary': '#100a0c',
      '--bg-secondary': '#180e12',
      '--bg-card': '#22141a',
      '--bg-card-hover': '#2c1a22',
      '--bg-surface': '#301e28',
      '--bg-input': '#160c10',
      '--border': '#3d2230',
      '--border-light': '#502d40',
      '--text-primary': '#f0e4e8',
      '--text-secondary': '#a88898',
      '--text-muted': '#704860',
      '--accent-purple': '#e17055',
      '--accent-purple-hover': '#e88a78',
      '--accent-cyan': '#fab1a0',
      '--accent-green': '#fd79a8',
      '--shadow': '0 4px 24px rgba(0,0,0,0.45)',
      '--shadow-lg': '0 8px 40px rgba(0,0,0,0.65)',
    },
  },
  light: {
    name: 'Claro',
    vars: {
      '--bg-primary': '#f5f5f8',
      '--bg-secondary': '#ffffff',
      '--bg-card': '#f0f0f5',
      '--bg-card-hover': '#eaeaf0',
      '--bg-surface': '#e8e8f0',
      '--bg-input': '#ffffff',
      '--border': '#d8d8e4',
      '--border-light': '#c8c8d8',
      '--text-primary': '#1a1a2e',
      '--text-secondary': '#555570',
      '--text-muted': '#9090a8',
      '--accent-purple': '#6c5ce7',
      '--accent-purple-hover': '#5a4bd6',
      '--accent-cyan': '#0097a7',
      '--accent-green': '#00897b',
      '--shadow': '0 4px 24px rgba(0,0,0,0.08)',
      '--shadow-lg': '0 8px 40px rgba(0,0,0,0.12)',
    },
  },
};

// ─── Planos de Fundo ───
const BACKGROUNDS = {
  none: { name: 'Nenhum', css: 'none' },
  grid: {
    name: 'Grid Sutil',
    css: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M40 0v40M0 0h40' stroke='%23ffffff' stroke-opacity='0.03' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  dots: {
    name: 'Pontos',
    css: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23ffffff' fill-opacity='0.04'/%3E%3C/svg%3E")`,
  },
  diagonal: {
    name: 'Diagonal',
    css: `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 16L16 0' stroke='%23ffffff' stroke-opacity='0.025' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  gradient1: {
    name: 'Gradiente Roxo',
    css: 'linear-gradient(135deg, rgba(108,92,231,0.06) 0%, rgba(0,210,211,0.04) 100%)',
  },
  gradient2: {
    name: 'Gradiente Coral',
    css: 'linear-gradient(135deg, rgba(225,112,85,0.06) 0%, rgba(253,203,110,0.04) 100%)',
  },
  gradient3: {
    name: 'Gradiente Esmeralda',
    css: 'linear-gradient(135deg, rgba(0,184,148,0.06) 0%, rgba(0,210,211,0.04) 100%)',
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('sales_theme') || 'dark');
  const [bgId, setBgId] = useState(() => localStorage.getItem('sales_bg') || 'none');
  const [customBgUrl, setCustomBgUrl] = useState(() => localStorage.getItem('sales_custom_bg') || '');
  const [bgOpacity, setBgOpacity] = useState(() => parseFloat(localStorage.getItem('sales_bg_opacity')) || 0.5);

  // Aplicar tema
  const applyTheme = useCallback((id) => {
    const theme = THEMES[id];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, []);

  // Aplicar fundo
  const applyBg = useCallback((id, customUrl, opacity) => {
    const el = document.getElementById('app-bg-layer');
    if (!el) return;

    if (id === 'custom' && customUrl) {
      el.style.backgroundImage = `url(${customUrl})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.opacity = opacity;
    } else if (id !== 'none' && BACKGROUNDS[id]) {
      el.style.backgroundImage = BACKGROUNDS[id].css;
      el.style.backgroundSize = id.startsWith('gradient') ? '100% 100%' : 'auto';
      el.style.backgroundPosition = 'center';
      el.style.opacity = 1;
    } else {
      el.style.backgroundImage = 'none';
      el.style.opacity = 0;
    }
  }, []);

  useEffect(() => {
    applyTheme(themeId);
    localStorage.setItem('sales_theme', themeId);
  }, [themeId, applyTheme]);

  useEffect(() => {
    applyBg(bgId, customBgUrl, bgOpacity);
    localStorage.setItem('sales_bg', bgId);
    localStorage.setItem('sales_custom_bg', customBgUrl);
    localStorage.setItem('sales_bg_opacity', bgOpacity);
  }, [bgId, customBgUrl, bgOpacity, applyBg]);

  const changeTheme = (id) => setThemeId(id);
  const changeBg = (id) => setBgId(id);
  const changeCustomBg = (url) => { setCustomBgUrl(url); setBgId('custom'); };
  const changeOpacity = (val) => setBgOpacity(val);

  return (
    <ThemeContext.Provider value={{
      themeId, bgId, customBgUrl, bgOpacity,
      themes: THEMES, backgrounds: BACKGROUNDS,
      changeTheme, changeBg, changeCustomBg, changeOpacity,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
