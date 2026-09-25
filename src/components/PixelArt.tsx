import type { ReactElement } from 'react';

/** Пиксельный рисунок из строк: каждый символ — клетка, точка — пусто. */
export function PixelArt({
  rows, colors, size, className = '',
}: {
  rows: string[];
  colors: Record<string, string>;
  /** Ширина в CSS-пикселях; высота по пропорции. */
  size: number;
  className?: string;
}) {
  const w = rows[0].length;
  const h = rows.length;
  const cells: ReactElement[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = colors[ch];
      if (c) cells.push(<rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill={c} />);
    });
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      shapeRendering="crispEdges"
      aria-hidden
      className={`block ${className}`}
    >
      {cells}
    </svg>
  );
}
