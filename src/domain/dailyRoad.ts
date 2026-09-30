/**
 * Дневной переход (замена сердечек дневной цели): цель дня — путь от утренней стоянки до привала. Четыре верстовых
 * камня делят его на пять частей, как прежние пять сердец; пройденный камень загорается руной, у цели загорается
 * костёр привала. Огонёк стрика рядом — число ночей подряд у костра.
 */

/** Верстовые камни — доли цели дня. */
export const ROAD_STONES = [0.2, 0.4, 0.6, 0.8] as const;

export interface RoadState {
  /** Пройденная доля пути, 0–1. */
  ratio: number;
  /** Пройден ли каждый камень. */
  stones: boolean[];
  /** Путник у костра: цель дня выполнена. */
  camp: boolean;
}

export function roadState(xp: number, goal: number): RoadState {
  const ratio = goal > 0 ? Math.min(1, Math.max(0, xp / goal)) : 0;
  return { ratio, stones: ROAD_STONES.map((s) => ratio >= s), camp: ratio >= 1 };
}
