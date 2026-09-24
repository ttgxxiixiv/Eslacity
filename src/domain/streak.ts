import { ECONOMY } from '../config';

export interface StreakState {
  count: number;
  best: number;
  /** Номер дня, когда цель была выполнена последний раз (или покрыт заморозкой). */
  lastDay: number | null;
  freezes: number;
  freezesUsed: number;
}

export const EMPTY_STREAK: StreakState = { count: 0, best: 0, lastDay: null, freezes: 0, freezesUsed: 0 };

/**
 * Проверка при открытии приложения. Пропущенные дни закрываются заморозками,
 * если их хватает на все пропуски. Иначе стрик обнуляется, заморозки остаются.
 */
export function settleStreak(s: StreakState, today: number): StreakState {
  if (s.lastDay === null || s.count === 0) return s;
  const missed = today - s.lastDay - 1;
  if (missed <= 0) return s;
  if (s.freezes >= missed) {
    return { ...s, freezes: s.freezes - missed, freezesUsed: s.freezesUsed + missed, lastDay: today - 1 };
  }
  return { ...s, count: 0 };
}

/** Дневная цель выполнена сегодня. */
export function registerGoal(s: StreakState, today: number): StreakState {
  if (s.lastDay === today) return s;
  const count = s.lastDay === today - 1 && s.count > 0 ? s.count + 1 : 1;
  return { ...s, count, best: Math.max(s.best, count), lastDay: today };
}

/** Стрик ещё жив: цель выполнена сегодня или вчера. */
export function isAlive(s: StreakState, today: number): boolean {
  return s.count > 0 && s.lastDay !== null && s.lastDay >= today - 1;
}

export function canBuyFreeze(s: StreakState, coins: number): boolean {
  return s.freezes < ECONOMY.maxFreezes && coins >= ECONOMY.freezeCost;
}
