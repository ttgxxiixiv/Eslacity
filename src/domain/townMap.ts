/**
 * Геометрия карты города по картинке src/assets/city.webp (891×1108 px).
 * Все координаты в пикселях картинки; на экране переводятся в проценты её ширины и высоты.
 *
 * Участки 4×5. Вертикальные дороги между столбцами, горизонтальные между рядами,
 * по краям дорог нет. Герой стоит на вертикальной дороге рядом со зданием,
 * чтобы не закрывать ни название, ни табличку с уровнем или ценой.
 */

export const MAP_W = 891;
export const MAP_H = 1108;
export const COLS = 4;

/** Центры вертикальных дорог (между столбцами 0|1, 1|2, 2|3). */
export const V_ROADS = [234, 444, 655];
/** Центры горизонтальных дорог (между рядами). */
export const H_ROADS = [238, 441, 658, 860];

/** Границы участков. */
const COL_X: [number, number][] = [[16, 217], [251, 427], [461, 638], [672, 876]];
const ROW_Y: [number, number][] = [[14, 222], [254, 424], [458, 641], [675, 843], [877, 1086]];

/** Центры второй строки подписи (звёзды или цена) на картинке: её закрывает табличка. */
const LABEL_X = [129, 341, 552, 763];
const LABEL_Y = [176, 386, 598, 808, 1020];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const colOf = (i: number) => i % COLS;
const rowOf = (i: number) => Math.floor(i / COLS);

export function plotRect(i: number): Rect {
  const [x0, x1] = COL_X[colOf(i)];
  const [y0, y1] = ROW_Y[rowOf(i)];
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function labelCenter(i: number): Point {
  return { x: LABEL_X[colOf(i)], y: LABEL_Y[rowOf(i)] };
}

/**
 * Где стоит герой у здания. Слева от последнего столбца дорога общая с соседом,
 * поэтому там герой встаёт выше, у верхней части участка.
 */
export function door(i: number): Point {
  const col = colOf(i);
  const row = rowOf(i);
  if (col < COLS - 1) return { x: V_ROADS[col], y: LABEL_Y[row] };
  return { x: V_ROADS[COLS - 2], y: LABEL_Y[row] - 110 };
}

/**
 * Путь от здания from до здания to по дорогам. Обе точки стоят на вертикальных дорогах:
 * если дорога одна, идём прямо, иначе выходим на горизонтальную дорогу,
 * которая даёт самый короткий путь, и по ней переходим на нужную вертикальную.
 */
export function route(from: number, to: number): Point[] {
  const a = door(from);
  const b = door(to);
  let pts: Point[];
  if (a.x === b.x) {
    pts = [a, b];
  } else {
    const y = H_ROADS.reduce((best, h) =>
      Math.abs(a.y - h) + Math.abs(b.y - h) < Math.abs(a.y - best) + Math.abs(b.y - best) ? h : best,
    );
    pts = [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  return pts.filter((p, k) => k === 0 || p.x !== pts[k - 1].x || p.y !== pts[k - 1].y);
}

export function pathLength(pts: Point[]): number {
  let n = 0;
  for (let k = 1; k < pts.length; k++) n += Math.abs(pts[k].x - pts[k - 1].x) + Math.abs(pts[k].y - pts[k - 1].y);
  return n;
}
