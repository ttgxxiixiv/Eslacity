import { ECONOMY } from '../config';
import type { LocationMeta } from '../content/schema';

/** Цена улучшения здания до уровня `toLevel` (2..5). */
export function upgradeCost(loc: LocationMeta, toLevel: number): number {
  const base = Math.max(loc.unlockCost, 50);
  const raw = base * toLevel * ECONOMY.upgradeFactor;
  return Math.max(ECONOMY.minUpgradeCost, Math.round(raw / 10) * 10);
}
