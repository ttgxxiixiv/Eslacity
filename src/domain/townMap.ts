/**
 * Геометрия карты города. Все размеры в долях ширины карты (0-100):
 * участки 4×5, между ними дороги. Горизонтальная дорога идёт под каждым рядом,
 * вертикальные — между столбцами и по краям. У каждого здания герой встаёт на перекрёсток
 * справа внизу: там он стоит на дороге и не закрывает название и уровень здания.
 */

export const COLS = 4;
export const ROAD = 5;
export const PLOT = (100 - (COLS + 1) * ROAD) / COLS;

export interface Point {
  x: number;
  y: number;
}

export function rowsFor(count: number): number {
  return Math.ceil(count / COLS);
}

/** Высота карты в тех же единицах. */
export function mapHeight(rows: number): number {
  return ROAD + rows * (PLOT + ROAD);
}

export function plotOrigin(i: number): Point {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: ROAD + col * (PLOT + ROAD), y: ROAD + row * (PLOT + ROAD) };
}

/** Центр горизонтальной дороги под рядом. */
export function roadY(row: number): number {
  return ROAD + row * (PLOT + ROAD) + PLOT + ROAD / 2;
}

/** Центр вертикальной дороги слева от столбца col (col = COLS — правый край). */
export function roadX(col: number): number {
  return ROAD / 2 + col * (PLOT + ROAD);
}

export function door(i: number): Point {
  return { x: roadX((i % COLS) + 1), y: roadY(Math.floor(i / COLS)) };
}

/**
 * Путь от здания from до здания to по дорогам: вдоль горизонтальной дороги своего ряда
 * до нужной вертикальной, потом по ней до нужного ряда.
 * Возвращает точки поворота, включая начало и конец, без повторов.
 */
export function route(from: number, to: number): Point[] {
  const a = door(from);
  const b = door(to);
  const pts = [a, { x: b.x, y: a.y }, b];
  return pts.filter((p, k) => k === 0 || p.x !== pts[k - 1].x || p.y !== pts[k - 1].y);
}

export function pathLength(pts: Point[]): number {
  let n = 0;
  for (let k = 1; k < pts.length; k++) n += Math.abs(pts[k].x - pts[k - 1].x) + Math.abs(pts[k].y - pts[k - 1].y);
  return n;
}
