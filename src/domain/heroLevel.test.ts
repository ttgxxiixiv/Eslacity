import { describe, expect, it } from 'vitest';
import { heroLevel, levelCost } from './heroLevel';

describe('уровень персонажа', () => {
  it('начинается с первого уровня', () => {
    expect(heroLevel(0)).toEqual({ level: 1, into: 0, need: 100 });
  });

  it('переходит на следующий уровень ровно на пороге', () => {
    expect(heroLevel(99).level).toBe(1);
    expect(heroLevel(100)).toEqual({ level: 2, into: 0, need: levelCost(2) });
    expect(heroLevel(100 + levelCost(2) + 5)).toEqual({ level: 3, into: 5, need: levelCost(3) });
  });

  it('каждый следующий уровень дороже предыдущего, и прирост тоже растёт', () => {
    for (let n = 1; n < 60; n++) {
      expect(levelCost(n + 1)).toBeGreaterThan(levelCost(n));
      expect(levelCost(n + 2) - levelCost(n + 1)).toBeGreaterThanOrEqual(levelCost(n + 1) - levelCost(n));
    }
  });

  it('отрицательный и дробный опыт не ломают расчёт', () => {
    expect(heroLevel(-5).level).toBe(1);
    expect(heroLevel(150.7)).toEqual({ level: 2, into: 50, need: levelCost(2) });
  });
});
