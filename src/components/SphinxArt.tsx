/**
 * Сфинкс у Врат (задача 8.2): пиксельный спрайт кодом. Лежащий лев из песчаника с человеческой головой
 * в полосатом платке. `watching` — глаза светятся золотом (Сфинкс загадывает загадку).
 */
const SAND = '#d9b26a';
const SHADE = '#a97f3e';
const DARK = '#3b2a1a';
const FACE = '#c9965a';
const GOLD = '#e0b43c';
const BLUE = '#2f4f8f';

type R = [x: number, y: number, w: number, h: number, fill: string];

const BODY: R[] = [
  // Тень и земля.
  [2, 25, 38, 1, DARK],
  // Хвост.
  [37, 18, 2, 5, SHADE],
  [38, 16, 2, 3, DARK],
  // Спина и туловище.
  [16, 13, 20, 2, SAND],
  [14, 15, 23, 8, SAND],
  [15, 21, 22, 2, SHADE],
  // Задняя лапа.
  [27, 18, 9, 7, SHADE],
  [28, 19, 7, 5, SAND],
  [27, 24, 10, 1, SHADE],
  // Грудь.
  [9, 12, 9, 12, SAND],
  [9, 12, 1, 12, SHADE],
  // Передние лапы.
  [3, 21, 15, 4, SAND],
  [3, 24, 15, 1, SHADE],
  [4, 23, 1, 1, SHADE],
  [6, 23, 1, 1, SHADE],
  [8, 23, 1, 1, SHADE],
  // Платок: верх и боковые крылья.
  [7, 2, 12, 3, GOLD],
  [6, 5, 3, 9, GOLD],
  [17, 5, 3, 9, GOLD],
  [7, 3, 12, 1, BLUE],
  [6, 6, 3, 1, BLUE],
  [6, 8, 3, 1, BLUE],
  [6, 10, 3, 1, BLUE],
  [6, 12, 3, 1, BLUE],
  [17, 6, 3, 1, BLUE],
  [17, 8, 3, 1, BLUE],
  [17, 10, 3, 1, BLUE],
  [17, 12, 3, 1, BLUE],
  // Змейка надо лбом.
  [12, 0, 2, 2, GOLD],
  // Лицо.
  [9, 5, 8, 8, FACE],
  [9, 5, 8, 1, SHADE],
  [12, 9, 2, 1, SHADE],
  [11, 11, 4, 1, DARK],
  // Бородка.
  [12, 13, 2, 3, BLUE],
  [12, 14, 2, 1, GOLD],
];

export function SphinxArt({ size = 160, watching = false }: { size?: number; watching?: boolean }) {
  const eye = watching ? GOLD : DARK;
  return (
    <svg
      viewBox="0 0 41 26"
      width={size}
      height={(size * 26) / 41}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Сфинкс"
      data-testid="sphinx-art"
    >
      {BODY.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
      <rect x={10} y={7} width={2} height={1} fill={eye} />
      <rect x={14} y={7} width={2} height={1} fill={eye} />
      {watching && (
        <>
          <rect x={10} y={6} width={2} height={1} fill={GOLD} opacity={0.4} />
          <rect x={14} y={6} width={2} height={1} fill={GOLD} opacity={0.4} />
        </>
      )}
    </svg>
  );
}
