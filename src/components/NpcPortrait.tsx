import { useMemo } from 'react';
import type { NpcLook } from '../content/schema';
import { LANG } from '../lang';
import { NPC_H, NPC_W, npcPixels } from './npcArt';

// Рисованные портреты по языкам: src/assets/portraits/<язык>/<имя>.webp (режет scripts/cut-portraits.py).
const ART = import.meta.glob<string>('../assets/portraits/*/*.webp', { eager: true, import: 'default' });

/** Картинка рисованного портрета персонажа в текущем языке, если она есть. */
export function portraitUrl(look: NpcLook): string | undefined {
  return look.portrait ? ART[`../assets/portraits/${LANG}/${look.portrait}.webp`] : undefined;
}

/**
 * Портрет жителя: рисованный, если у персонажа есть `look.portrait`, иначе пиксельный. size — высота
 * в CSS-пикселях, ширина в пропорции 14:18. pixel — всегда пиксельная фигурка: на картах города и странствий
 * житель стоит в полный рост, и там же портрет рисуется внутри SVG, куда картинку не вставить.
 */
export function NpcPortrait({ look, size = 72, label, className = '', pixel = false }: {
  look: NpcLook;
  size?: number;
  label?: string;
  className?: string;
  pixel?: boolean;
}) {
  const pixels = useMemo(() => npcPixels(look), [look]);
  const width = (size * NPC_W) / NPC_H;
  const art = pixel ? undefined : portraitUrl(look);
  if (art) {
    return (
      <img
        src={art}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        width={width}
        height={size}
        loading="lazy"
        data-testid="npc-art"
        className={`shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(26_15_7/0.6)] ${className}`}
        style={{ width, height: size }}
      />
    );
  }
  return (
    <svg
      viewBox={`0 0 ${NPC_W} ${NPC_H}`}
      height={size}
      width={width}
      shapeRendering="crispEdges"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pixels.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width="1" height="1" fill={p.fill} />
      ))}
    </svg>
  );
}
