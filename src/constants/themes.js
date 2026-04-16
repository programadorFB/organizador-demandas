export const SOLID_COLORS = [
  { id: 'gold',    name: 'Dourado',  color: '#C9971A' },
  { id: 'purple',  name: 'Violeta',  color: '#8b5cf6' },
  { id: 'emerald', name: 'Esmeralda',color: '#10b981' },
  { id: 'rose',    name: 'Rosa',     color: '#f43f5e' },
  { id: 'azure',   name: 'Azure',    color: '#3b82f6' },
  { id: 'teal',    name: 'Teal',     color: '#14b8a6' },
];

// Cada tema de anime carrega uma paleta inteira que substitui as variáveis
// de background/linha do board inteiro, além do accent.
export const ANIME_THEMES = [
  {
    id: 'dbz', name: 'Dragon Ball Z', sub: 'Super Saiyajin',
    accent: '#fbbf24', secondary: '#3b82f6',
    palette: {
      '--accent': '#fbbf24',
      '--accent-2': '#3b82f6',
      '--accent-3': '#f97316',
      '--bg-0': '#120b04', '--bg-1': '#1a1208', '--bg-2': '#22180c',
      '--bg-3': '#2b2012', '--bg-4': '#332719',
      '--line-1': '#2a1f0f', '--line-2': '#3a2d18',
    },
  },
  {
    id: 'naruto', name: 'Naruto', sub: 'Rasengan',
    accent: '#ff6b35', secondary: '#1e40af',
    palette: {
      '--accent': '#ff6b35',
      '--accent-2': '#1e40af',
      '--accent-3': '#facc15',
      '--bg-0': '#100804', '--bg-1': '#180c05', '--bg-2': '#211208',
      '--bg-3': '#2a180c', '--bg-4': '#331e10',
      '--line-1': '#2a170c', '--line-2': '#3a2214',
    },
  },
  {
    id: 'onepiece', name: 'One Piece', sub: 'Mugiwara',
    accent: '#dc2626', secondary: '#f59e0b',
    palette: {
      '--accent': '#dc2626',
      '--accent-2': '#f59e0b',
      '--accent-3': '#0ea5e9',
      '--bg-0': '#120505', '--bg-1': '#1b0808', '--bg-2': '#240c0c',
      '--bg-3': '#2e1010', '--bg-4': '#371717',
      '--line-1': '#2e0f0f', '--line-2': '#3e1818',
    },
  },
  {
    id: 'blackclover', name: 'Black Clover', sub: 'Black Bulls',
    accent: '#10b981', secondary: '#111111',
    palette: {
      '--accent': '#10b981',
      '--accent-2': '#6d28d9',
      '--accent-3': '#dc2626',
      '--bg-0': '#040806', '--bg-1': '#060c08', '--bg-2': '#08120c',
      '--bg-3': '#0b1a11', '--bg-4': '#102318',
      '--line-1': '#0d1f14', '--line-2': '#14301e',
    },
  },
  {
    id: 'demonslayer', name: 'Demon Slayer', sub: 'Nichirin',
    accent: '#16a34a', secondary: '#ec4899',
    palette: {
      '--accent': '#16a34a',
      '--accent-2': '#ec4899',
      '--accent-3': '#fbbf24',
      '--bg-0': '#050e07', '--bg-1': '#07140a', '--bg-2': '#0a1c0e',
      '--bg-3': '#0e2513', '--bg-4': '#142f1a',
      '--line-1': '#122c18', '--line-2': '#1b3d22',
    },
  },
  {
    id: 'jjk', name: 'Jujutsu Kaisen', sub: 'Cursed Energy',
    accent: '#3b82f6', secondary: '#7c3aed',
    palette: {
      '--accent': '#3b82f6',
      '--accent-2': '#7c3aed',
      '--accent-3': '#dc2626',
      '--bg-0': '#05070f', '--bg-1': '#070a17', '--bg-2': '#0a0e22',
      '--bg-3': '#0e142e', '--bg-4': '#141c3c',
      '--line-1': '#141a33', '--line-2': '#1e2648',
    },
  },
  {
    id: 'chainsawman', name: 'Chainsaw Man', sub: 'Devil Hunter',
    accent: '#ea580c', secondary: '#facc15',
    palette: {
      '--accent': '#ea580c',
      '--accent-2': '#facc15',
      '--accent-3': '#dc2626',
      '--bg-0': '#100603', '--bg-1': '#180a05', '--bg-2': '#211008',
      '--bg-3': '#2a160c', '--bg-4': '#341c12',
      '--line-1': '#2a140a', '--line-2': '#3a1e13',
    },
  },
  {
    id: 'mha', name: 'My Hero Academia', sub: 'Plus Ultra',
    accent: '#15803d', secondary: '#dc2626',
    palette: {
      '--accent': '#15803d',
      '--accent-2': '#dc2626',
      '--accent-3': '#3b82f6',
      '--bg-0': '#040c06', '--bg-1': '#071209', '--bg-2': '#0a1a0d',
      '--bg-3': '#0d2311', '--bg-4': '#132c17',
      '--line-1': '#102917', '--line-2': '#18391f',
    },
  },
  {
    id: 'evangelion', name: 'Evangelion', sub: 'EVA-01',
    accent: '#7e22ce', secondary: '#84cc16',
    palette: {
      '--accent': '#7e22ce',
      '--accent-2': '#84cc16',
      '--accent-3': '#f97316',
      '--bg-0': '#0c0516', '--bg-1': '#110720', '--bg-2': '#180a2d',
      '--bg-3': '#1f0e3a', '--bg-4': '#28154a',
      '--line-1': '#25124a', '--line-2': '#321b5e',
    },
  },
  {
    id: 'bleach', name: 'Bleach', sub: 'Bankai',
    accent: '#f97316', secondary: '#1e40af',
    palette: {
      '--accent': '#f97316',
      '--accent-2': '#1e40af',
      '--accent-3': '#ffffff',
      '--bg-0': '#100703', '--bg-1': '#180a05', '--bg-2': '#211008',
      '--bg-3': '#2b160c', '--bg-4': '#351d12',
      '--line-1': '#2a140a', '--line-2': '#3a1f12',
    },
  },
  {
    id: 'sailormoon', name: 'Sailor Moon', sub: 'Moon Prism',
    accent: '#ec4899', secondary: '#a855f7',
    palette: {
      '--accent': '#ec4899',
      '--accent-2': '#a855f7',
      '--accent-3': '#fbbf24',
      '--bg-0': '#100510', '--bg-1': '#170818', '--bg-2': '#200c22',
      '--bg-3': '#29102c', '--bg-4': '#341538',
      '--line-1': '#2a1230', '--line-2': '#3a1d40',
    },
  },
  {
    id: 'aot', name: 'Attack on Titan', sub: 'Survey Corps',
    accent: '#b91c1c', secondary: '#10b981',
    palette: {
      '--accent': '#b91c1c',
      '--accent-2': '#10b981',
      '--accent-3': '#78350f',
      '--bg-0': '#0f0604', '--bg-1': '#170906', '--bg-2': '#1f0e0a',
      '--bg-3': '#28130d', '--bg-4': '#321a13',
      '--line-1': '#2a120c', '--line-2': '#3a1c15',
    },
  },
  {
    id: 'opm', name: 'One Punch Man', sub: 'Saitama',
    accent: '#facc15', secondary: '#dc2626',
    palette: {
      '--accent': '#facc15',
      '--accent-2': '#dc2626',
      '--accent-3': '#f97316',
      '--bg-0': '#120f04', '--bg-1': '#1a1606', '--bg-2': '#231e0a',
      '--bg-3': '#2d260e', '--bg-4': '#363015',
      '--line-1': '#2a2410', '--line-2': '#3a3217',
    },
  },
];

export const ANIME_THEME_MAP = Object.fromEntries(ANIME_THEMES.map(t => [t.id, t]));

export const ANIME_PREFIX = 'anime:';

export function parseAccentValue(raw) {
  if (!raw) return { type: 'solid', value: null };
  if (typeof raw === 'string' && raw.startsWith(ANIME_PREFIX)) {
    const id = raw.slice(ANIME_PREFIX.length);
    const theme = ANIME_THEME_MAP[id];
    if (theme) return { type: 'anime', id, theme };
  }
  return { type: 'solid', value: raw };
}
