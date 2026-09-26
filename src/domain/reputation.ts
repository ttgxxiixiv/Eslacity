/**
 * Репутация (docs/GAME.md, «Репутация»): отношение героя с каждым жителем. Очки дают поручения (позже — миссии).
 * Ступень открывает тёплые приветствия, скидку на улучшение здания места и сюжетную миссию следующей главы.
 */

export interface Rank {
  id: 'stranger' | 'acquaintance' | 'pal' | 'friend' | 'loyal';
  ru: string;
  /** С какого числа очков. */
  at: number;
  /** Скидка на улучшение здания места. */
  discount: number;
}

export const RANKS: Rank[] = [
  { id: 'stranger', ru: 'Незнакомец', at: 0, discount: 0 },
  { id: 'acquaintance', ru: 'Знакомый', at: 2, discount: 0 },
  { id: 'pal', ru: 'Приятель', at: 5, discount: 0.05 },
  { id: 'friend', ru: 'Друг', at: 10, discount: 0.1 },
  { id: 'loyal', ru: 'Верный друг', at: 20, discount: 0.15 },
];

/** Номер ступени по очкам (0 — Незнакомец). */
export function rankIndex(points: number): number {
  let i = 0;
  RANKS.forEach((r, j) => {
    if (points >= r.at) i = j;
  });
  return i;
}

export const rankOf = (points: number): Rank => RANKS[rankIndex(points)];

/** Следующая ступень и сколько очков до неё; null — выше некуда. */
export function nextRank(points: number): { rank: Rank; left: number } | null {
  const r = RANKS[rankIndex(points) + 1];
  return r ? { rank: r, left: r.at - points } : null;
}

/** Цена улучшения здания со скидкой жителя. Открытие места скидки не даёт: житель ещё не знаком. */
export function discountedCost(cost: number, points: number): number {
  return Math.round(cost * (1 - rankOf(points).discount));
}

/**
 * Приветствие жителя по ступени: с Приятеля — тёплые реплики (`warm[0]` Приятель, `warm[1]` Друг, `warm[2]` Верный друг),
 * до этого — обычное.
 */
export function greetingFor<T>(base: T, warm: T[], points: number): T {
  const i = rankIndex(points) - 2;
  return i >= 0 ? (warm[Math.min(i, warm.length - 1)] ?? base) : base;
}

/** Жители с отношением «Друг» и выше: медаль «Друг города». */
export function friendsCount(rep: Record<string, number>): number {
  return Object.values(rep).filter((p) => p >= RANKS[3].at).length;
}

/**
 * Сюжетная миссия следующей главы открывается с Приятеля (docs/GAME.md). Миссия главы I открыта сразу:
 * с жителем только знакомимся.
 */
export const MISSION_RANK = 2;
export const missionOpen = (points: number, chapter = 2) => chapter <= 1 || rankIndex(points) >= MISSION_RANK;
