import { useMemo } from 'react';
import type { NpcLook } from '../content/schema';
import { NPC_H, NPC_W, npcPixels } from './npcArt';

/** Пиксельный портрет жителя. size — высота в CSS-пикселях, кратная 18, чтобы пиксели были ровными. */
export function NpcPortrait({ look, size = 72, label, className = '' }: { look: NpcLook; size?: number; label?: string; className?: string }) {
  const pixels = useMemo(() => npcPixels(look), [look]);
  return (
    <svg
      viewBox={`0 0 ${NPC_W} ${NPC_H}`}
      height={size}
      width={(size * NPC_W) / NPC_H}
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
