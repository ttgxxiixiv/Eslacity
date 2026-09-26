/**
 * Геометрия карты земли: поле 5×4 обрывка с рваными краями. Соседние обрывки делят одни и те же
 * точки края, поэтому складываются без щелей. Всё детерминировано: одна и та же карта при каждом показе.
 */

export const COLS = 5;
export const ROWS = 4;
export const CELL = 64;
export const MAP_W = COLS * CELL;
export const MAP_H = ROWS * CELL;
/** Печать в центре карты. */
export const SEAL = { x: MAP_W / 2, y: MAP_H / 2, r: 27 };

/** Псевдослучайное число 0..1 по двум целым: одинаковое при каждом запуске. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

type P = [number, number];

/** Угол сетки: внутренние углы чуть сдвинуты, внешние лежат на краю карты. */
function corner(i: number, j: number): P {
  const x = i * CELL + (i > 0 && i < COLS ? (hash(i, j) - 0.5) * 12 : 0);
  const y = j * CELL + (j > 0 && j < ROWS ? (hash(j + 50, i) - 0.5) * 12 : 0);
  return [x, y];
}

/**
 * Точки рваного края между двумя углами. Край общий для двух обрывков, поэтому точки зависят
 * только от самого края, а для соседа берутся в обратном порядке. Край по границе карты ровный.
 */
function edge(a: P, b: P, key: number, outer: boolean): P[] {
  if (outer) return [];
  const pts: P[] = [];
  const n = 4;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const off = (hash(key, k) - 0.5) * 9;
    pts.push([a[0] + dx * t + (-dy / len) * off, a[1] + dy * t + (dx / len) * off]);
  }
  return pts;
}

const hKey = (i: number, j: number) => 1000 + j * 10 + i;
const vKey = (i: number, j: number) => 2000 + j * 10 + i;

/** Многоугольник обрывка в строке и столбце, как строка для атрибута points. */
export function cellPolygon(col: number, row: number): string {
  const tl = corner(col, row);
  const tr = corner(col + 1, row);
  const br = corner(col + 1, row + 1);
  const bl = corner(col, row + 1);
  const top = edge(tl, tr, hKey(col, row), row === 0);
  const right = edge(tr, br, vKey(col + 1, row), col + 1 === COLS);
  // Нижний и левый края общие с соседями: считаем в их направлении и разворачиваем.
  const bottom = edge(bl, br, hKey(col, row + 1), row + 1 === ROWS).reverse();
  const left = edge(tl, bl, vKey(col, row), col === 0).reverse();
  return [tl, ...top, tr, ...right, br, ...bottom, bl, ...left].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** Центр обрывка: для значка места. */
export function cellCenter(col: number, row: number): P {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2];
}

/** Место по номеру: слева направо, сверху вниз. */
export const cellOf = (index: number) => ({ col: index % COLS, row: Math.floor(index / COLS) });
