import { Check } from 'lucide-react';
import styles from '../styles/AccentPicker.module.css';
import { SOLID_COLORS, ANIME_THEMES, ANIME_PREFIX, parseAccentValue } from '../constants/themes';

export default function AccentPicker({ value, onChange }) {
  const parsed = parseAccentValue(value);
  const currentSolid = parsed.type === 'solid' ? (parsed.value || '#C9971A').toLowerCase() : null;
  const currentAnimeId = parsed.type === 'anime' ? parsed.id : null;

  const SolidSwatch = ({ color, name }) => {
    const active = currentSolid === color.toLowerCase();
    return (
      <button
        type="button"
        className={`${styles.swatch} ${active ? styles.active : ''}`}
        onClick={() => onChange(color)}
        style={{ '--sw': color }}
        title={name}
      >
        <span className={styles.chip}>
          {active && <Check size={14} strokeWidth={3} />}
        </span>
        <span className={styles.swatchName}>{name}</span>
      </button>
    );
  };

  const AnimeSwatch = ({ theme }) => {
    const active = currentAnimeId === theme.id;
    return (
      <button
        type="button"
        className={`${styles.swatch} ${styles.swatchAnime} ${active ? styles.active : ''}`}
        onClick={() => onChange(ANIME_PREFIX + theme.id)}
        style={{
          '--sw': theme.accent,
          '--sw-2': theme.secondary,
          '--sw-3': theme.palette['--accent-3'] || theme.accent,
        }}
        title={theme.name}
      >
        <span className={styles.animeRing}>
          <span className={styles.chip}>
            {active && <Check size={14} strokeWidth={3} />}
          </span>
        </span>
        <span className={styles.swatchName}>{theme.name}</span>
        <span className={styles.swatchSub}>{theme.sub}</span>
      </button>
    );
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <h4 className={styles.groupTitle}>Cores</h4>
        <div className={styles.grid}>
          {SOLID_COLORS.map(c => <SolidSwatch key={c.id} color={c.color} name={c.name} />)}
        </div>
      </div>

      <div className={styles.group}>
        <h4 className={styles.groupTitle}>Temas de Anime</h4>
        <div className={styles.gridAnime}>
          {ANIME_THEMES.map(t => <AnimeSwatch key={t.id} theme={t} />)}
        </div>
      </div>
    </div>
  );
}
