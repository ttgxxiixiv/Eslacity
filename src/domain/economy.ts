import { ECONOMY } from '../config';
import type { LocationMeta } from '../content/schema';

const HOUR = 3_600_000;

/** Цена улучшения здания до уровня `toLevel` (2..5). Уровень 1 = открытие за unlockCost. */
export function upgradeCost(loc: LocationMeta, toLevel: number): number {
  if (toLevel <= 1) return loc.unlockCost;
  const base = Math.max(loc.unlockCost, 50);
  const raw = base * toLevel * ECONOMY.upgradeFactor;
  return Math.max(ECONOMY.minUpgradeCost, Math.round(raw / 10) * 10);
}

/** Монет в час с открытого здания. */
export function incomeRate(level: number): number {
  return level > 0 ? ECONOMY.incomePerLevelPerHour * level : 0;
}

export interface IncomeState {
  level: number;
  lastCollectedAt: number;
}

/** Сколько целых монет накопилось. Время сверх лимита не считается. */
export function pendingIncome(b: IncomeState, now: number): number {
  const rate = incomeRate(b.level);
  if (!rate) return 0;
  const hours = Math.min(ECONOMY.incomeCapHours, Math.max(0, now - b.lastCollectedAt) / HOUR);
  return Math.floor(rate * hours);
}

export function isFull(b: IncomeState, now: number): boolean {
  return b.level > 0 && now - b.lastCollectedAt >= ECONOMY.incomeCapHours * HOUR;
}

/**
 * Собрать доход. Дробная часть не сгорает: время сдвигается ровно на собранные монеты.
 * Если лимит уже достигнут, отсчёт начинается заново с текущего момента.
 */
export function collectIncome(b: IncomeState, now: number): { coins: number; lastCollectedAt: number } {
  const coins = pendingIncome(b, now);
  if (!coins) return { coins: 0, lastCollectedAt: b.lastCollectedAt };
  if (isFull(b, now)) return { coins, lastCollectedAt: now };
  return { coins, lastCollectedAt: b.lastCollectedAt + (coins / incomeRate(b.level)) * HOUR };
}
