import { describe, expect, it } from 'vitest';
import { LOCATION_BY_ID } from '../content/locations';
import { collectIncome, incomeRate, isFull, pendingIncome, upgradeCost } from './economy';

const H = 3_600_000;
const T = 1_000_000_000_000;

describe('цены', () => {
  it('открытие стоит unlockCost, улучшения растут с уровнем', () => {
    const market = LOCATION_BY_ID.market;
    expect(upgradeCost(market, 1)).toBe(60);
    const costs = [2, 3, 4, 5].map((l) => upgradeCost(market, l));
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(costs[0]).toBeGreaterThanOrEqual(40);
  });
  it('кафе бесплатное, но улучшения платные', () => {
    expect(upgradeCost(LOCATION_BY_ID.cafe, 1)).toBe(0);
    expect(upgradeCost(LOCATION_BY_ID.cafe, 2)).toBe(80);
  });
});

describe('пассивный доход', () => {
  it('ставка растёт с уровнем, закрытое здание ничего не даёт', () => {
    expect(incomeRate(0)).toBe(0);
    expect(incomeRate(1)).toBe(2);
    expect(incomeRate(3)).toBe(6);
    expect(pendingIncome({ level: 0, lastCollectedAt: T - 5 * H }, T)).toBe(0);
  });
  it('копится по времени', () => {
    expect(pendingIncome({ level: 2, lastCollectedAt: T - 2.5 * H }, T)).toBe(10);
  });
  it('упирается в лимит 8 часов', () => {
    const b = { level: 1, lastCollectedAt: T - 30 * H };
    expect(pendingIncome(b, T)).toBe(16);
    expect(isFull(b, T)).toBe(true);
    expect(collectIncome(b, T)).toEqual({ coins: 16, lastCollectedAt: T });
  });
  it('дробная часть не теряется при сборе', () => {
    // уровень 1 = 2 монеты/ч, прошло 45 минут → 1 монета, остаток 15 минут переносится
    const b = { level: 1, lastCollectedAt: T - 0.75 * H };
    const r = collectIncome(b, T);
    expect(r.coins).toBe(1);
    expect(r.lastCollectedAt).toBe(T - 0.25 * H);
    expect(pendingIncome({ level: 1, lastCollectedAt: r.lastCollectedAt }, T + 0.25 * H)).toBe(1);
  });
  it('часы, переведённые назад, не дают отрицательный доход', () => {
    expect(pendingIncome({ level: 1, lastCollectedAt: T + H }, T)).toBe(0);
  });
});
