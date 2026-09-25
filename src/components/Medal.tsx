import type { Tier } from '../domain/medals';
import { medalPixels, type MedalIcon } from './medalArt';

interface Props {
  icon: MedalIcon;
  /** null — ступень не получена, медаль рисуется тёмным силуэтом. */
  tier: Tier | null;
  /** Размер в CSS-пикселях, кратный 16, чтобы пиксели не размывались. */
  size?: number;
  /** Подпись для экранного диктора. Без неё медаль считается украшением. */
  label?: string;
}

/** Пиксельная медаль 16×16: лента, обод цвета ступени и значок линии. */
export function Medal({ icon, tier, size = 32, label }: Props) {
  const pixels = medalPixels(icon, tier);
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="medal shrink-0"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width="1"
          height="1"
          fill={p.fill}
          className={p.sparkle ? 'medal-sparkle' : undefined}
          style={p.sparkle ? { animationDelay: `${(i % 3) * 0.7}s` } : undefined}
        />
      ))}
    </svg>
  );
}
