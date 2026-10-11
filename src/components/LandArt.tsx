import type { ReactNode } from 'react';
import land1Open from '../assets/journey/land1-open.webp';
import land1Closed from '../assets/journey/land1-closed.webp';
import type { ChapterId, ChapterState } from '../domain/chapters';
import { MAP_H, MAP_W } from './journeyArt';

/*
 * Рисунки земель и дорога глав: общие для карты странствий и сцены перехода главы (`ChapterScene`). Лежат отдельно
 * от экрана карты, чтобы сцена перехода не тянула его в главный чанк (задача 16.2).
 */

export const INK = '#5c452d';
export const PARCHMENT = '#f1dfb0';
export const DARK = '#2e2216';

/**
 * Нарисованные карты земель: закрытая лежит подложкой, открытая проступает в полученных обрывках.
 * Места на рисунке стоят в той же сетке 5×4, что и обрывки. Для земель без рисунка карта рисуется кодом.
 */
export const LAND_IMAGES: Partial<Record<ChapterId, { open: string; closed: string; seal: { x: number; y: number; r: number } }>> = {
  1: { open: land1Open, closed: land1Closed, seal: { x: 164, y: 122, r: 28 } },
};
/** Точки у левого верхнего угла каждого обрывка: украшения рисунка не лезут на значки мест. */
const CORNERS: [number, number][] = Array.from({ length: 20 }, (_, i) => [(i % 5) * 64 + 13, Math.floor(i / 5) * 64 + 16]);

/** Рисунок земли под обрывками: у каждой главы свой пейзаж. Виден только в полученных обрывках. */
export function LandArt({ chapter }: { chapter: ChapterId }): ReactNode {
  const road = 'M -10 200 C 60 170, 90 230, 150 190 S 250 120, 330 60';
  const common = (
    <>
      <rect width={MAP_W} height={MAP_H} fill={PARCHMENT} />
      <path d={road} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" />
    </>
  );
  const trees = (pts: [number, number][], color: string) =>
    pts.map(([x, y], i) => (
      <g key={i}>
        <rect x={x - 1.5} y={y + 6} width="3" height="6" fill={INK} />
        <polygon points={`${x},${y - 10} ${x - 8},${y + 7} ${x + 8},${y + 7}`} fill={color} stroke={INK} strokeWidth="1" />
      </g>
    ));
  switch (chapter) {
    case 1:
      return (
        <>
          {common}
          <path d="M 0 90 C 60 70, 120 110, 190 80 S 290 40, 320 70" fill="none" stroke="#6f9fc2" strokeWidth="6" opacity="0.8" />
          {trees(CORNERS, '#6f9b45')}
        </>
      );
    case 2:
      return (
        <>
          {common}
          {CORNERS.map(([x, y], i) => (
            <g key={i}>
              <polygon points={`${x},${y - 12} ${x - 12},${y + 8} ${x + 12},${y + 8}`} fill="#a79a88" stroke={INK} strokeWidth="1" />
              <polygon points={`${x},${y - 12} ${x - 4},${y - 6} ${x + 4},${y - 6}`} fill="#fbf4de" />
            </g>
          ))}
        </>
      );
    case 3:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#ecd08e" />
          {[40, 100, 160, 220].map((y, i) => (
            <path key={i} d={`M 0 ${y} Q 80 ${y - 25}, 160 ${y} T 320 ${y}`} fill="none" stroke="#c9a15a" strokeWidth="3" />
          ))}
          <path d="M -10 200 C 60 170, 90 230, 150 190 S 250 120, 330 60" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" />
          <ellipse cx="250" cy="200" rx="26" ry="10" fill="#6fb3c9" opacity="0.8" />
          <rect x="246" y="170" width="3" height="22" fill={INK} />
          <path d="M 247 172 q -12 -6 -18 4 M 247 172 q 12 -6 18 4" stroke="#5d8b3a" strokeWidth="4" fill="none" />
        </>
      );
    case 4:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#d9d6a4" />
          <path d={road} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" />
          {trees(CORNERS, '#3f6b35')}
          {trees(CORNERS.map(([x, y]) => [x + 40, y + 34] as [number, number]), '#4d7d3e')}
        </>
      );
    default:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#e4d2b8" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x={20 + k * 24} y={20 + k * 16} width={280 - k * 48} height={216 - k * 32} fill="none" stroke={INK} strokeWidth="3" />
          ))}
          <path d={road} fill="none" stroke="#8a3a2a" strokeWidth="3" strokeDasharray="7 6" />
        </>
      );
  }
}

/**
 * Дорога через пять земель к Хранилищу, герой на текущей главе. Без onPick земли не нажимаются (сцена перехода),
 * смена `current` двигает героя по дороге плавно.
 */
export function Road({ state, current, shown, opened, onPick }: {
  state: ChapterState[];
  opened: number;
  current: ChapterId;
  shown: ChapterId;
  onPick?(id: ChapterId): void;
}) {
  const xs = [36, 99, 162, 225, 288];
  const ys = [70, 40, 72, 42, 70];
  const path = `M 10 80 ${xs.map((x, i) => `L ${x} ${ys[i]}`).join(' ')} L 345 55`;
  return (
    <svg viewBox="0 0 360 110" className="w-full" role="group" aria-label="Путь к Хранилищу">
      <rect width="360" height="110" rx="10" fill={PARCHMENT} stroke={INK} strokeWidth="2" />
      <path d={path} fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="5 5" />
      {state.map((c, i) => {
        const id = c.chapter.id;
        const done = c.complete;
        const open = id <= opened;
        return (
          <g
            key={id}
            role={onPick ? 'button' : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-label={`Глава ${c.chapter.roman}: ${c.chapter.land}${done ? ', карта собрана' : ''}`}
            aria-pressed={onPick ? shown === id : undefined}
            onClick={() => onPick?.(id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick?.(id)}
            className={onPick ? 'cursor-pointer outline-none' : undefined}
          >
            <circle cx={xs[i]} cy={ys[i]} r={shown === id ? 17 : 15} fill={done ? '#e0b43c' : open ? '#fbf4de' : '#8f7a5c'} stroke={DARK} strokeWidth={shown === id ? 3 : 2} />
            <text x={xs[i]} y={ys[i] + 5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={DARK}>
              {c.chapter.roman}
            </text>
            <text x={i === 0 ? 6 : xs[i]} y={ys[i] + (i % 2 ? -22 : 30)} textAnchor={i === 0 ? 'start' : 'middle'} fontSize="8.5" fill={INK}>
              {c.chapter.land}
            </text>
          </g>
        );
      })}
      {/* Хранилище в конце дороги. */}
      <g aria-label="Хранилище Эликсира">
        <rect x="333" y="36" width="22" height="26" rx="3" fill="#6b5a45" stroke={DARK} strokeWidth="2" />
        <path d="M 338 62 v -12 a 6 6 0 0 1 12 0 v 12" fill={DARK} />
      </g>
      {/* Герой: фигурка в плаще над текущей главой. */}
      <g
        className="hero-walk"
        style={{ transform: `translate(${xs[current - 1] + 13}px, ${ys[current - 1] - 20}px)` }}
        aria-label="Герой здесь"
        data-testid="hero"
      >
        <rect x="2" y="0" width="6" height="4" fill="#5a4128" />
        <rect x="1" y="4" width="8" height="10" fill="#5a4128" />
        <rect x="3" y="2" width="4" height="3" fill="#f1c9a0" />
        <rect x="0" y="14" width="3" height="2" fill={DARK} />
        <rect x="7" y="14" width="3" height="2" fill={DARK} />
        {/* Летописец идёт следом: лиловый балахон, седая борода, под мышкой свиток. */}
        <g transform="translate(12 2)" aria-label="Летописец" data-testid="road-chronicler">
          <rect x="2" y="0" width="6" height="2" fill="#d9d4c5" />
          <rect x="2" y="2" width="6" height="3" fill="#e0ad84" />
          <rect x="2" y="4" width="6" height="3" fill="#d9d4c5" />
          <rect x="1" y="6" width="8" height="8" fill="#6b4f8a" />
          <rect x="7" y="8" width="4" height="3" fill="#f1dfb0" />
          <rect x="1" y="14" width="3" height="2" fill={DARK} />
          <rect x="6" y="14" width="3" height="2" fill={DARK} />
        </g>
      </g>
    </svg>
  );
}
