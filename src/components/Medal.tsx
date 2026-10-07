import type { Tier } from '../domain/medals';
import FRAMES from '../assets/medals/frames.json';

// Картинки медалей режет scripts/build-medal-art.py из docs/design/medal-*.png (промты — docs/design/medals-prompt.md).
const ART = import.meta.glob<string>('../assets/medals/*.webp', { eager: true, import: 'default' });
const art = (name: string) => ART[`../assets/medals/${name}.webp`];

/** Значок медали: линия (её эмблема в оправе ступени), тайная медаль или ещё не полученная тайная. */
export type MedalIcon = string;

interface Props {
  /** id линии, `secret` (тогда `secret` — id тайной медали) или `hidden` — тайная, ещё не получена. */
  icon: MedalIcon;
  /** Ступень медали линии. null — как `locked` у самой простой ступени. */
  tier: Tier | null;
  /** Ступень ещё не получена: медаль видна тёмным силуэтом. */
  locked?: boolean;
  /** id тайной медали (`flawless`, `festival-carnevale`). Без него — медаль «Хранитель пути». */
  secret?: string;
  /** Размер в CSS-пикселях. */
  size?: number;
  /** Подпись для экранного диктора. Без неё медаль считается украшением. */
  label?: string;
}

const SILHOUETTE = 'grayscale(1) brightness(0.35) opacity(0.55)';
/** Скрытая тайная медаль — сплошная тень: видна только форма звезды, рисунок внутри не угадать. */
const SHADOW = 'brightness(0) opacity(0.3)';

/**
 * Медаль: у линии — оправа ступени (дерево, камень, бронза, серебро, золото, бриллиант) и эмблема линии в её круге,
 * у тайной — своя медаль-звезда целиком. Неполученное — тёмный силуэт той же медали.
 */
export function Medal({ icon, tier, locked = false, secret, size = 32, label }: Props) {
  const a11y = { role: label ? 'img' : undefined, 'aria-label': label, 'aria-hidden': label ? undefined : true } as const;
  if (icon === 'secret' || icon === 'hidden') {
    // Скрытая тайная медаль — силуэт звезды: форма одна у всех, по ней не угадать, какая это.
    const src = art(`secret-${icon === 'hidden' ? 'flawless' : (secret ?? 'keeper')}`);
    return (
      <span className="medal relative inline-block shrink-0" style={{ width: size, height: size }} {...a11y}>
        <img src={src} alt="" width={size} height={size} className="block h-full w-full" style={icon === 'hidden' ? { filter: SHADOW } : undefined} />
      </span>
    );
  }
  const t: Tier = tier ?? 'wood';
  const dim = locked || tier === null;
  const f = (FRAMES as Record<Tier, { x: number; y: number; r: number }>)[t];
  const d = 2 * f.r * size;
  return (
    <span className="medal relative inline-block shrink-0" style={{ width: size, height: size, filter: dim ? SILHOUETTE : undefined }} {...a11y}>
      <img src={art(`frame-${t}`)} alt="" width={size} height={size} className="absolute inset-0 block h-full w-full" />
      <img
        src={art(`emblem-${icon}`)}
        alt=""
        className="absolute block"
        style={{ width: d, height: d, left: f.x * size - d / 2, top: f.y * size - d / 2 }}
      />
    </span>
  );
}
