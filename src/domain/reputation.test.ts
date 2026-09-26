import { describe, expect, it } from 'vitest';
import { discountedCost, friendsCount, greetingFor, missionOpen, nextRank, rankOf, RANKS } from './reputation';

describe('репутация', () => {
  it('пять ступеней с растущими порогами и скидкой 0–15%', () => {
    expect(RANKS.map((r) => r.ru)).toEqual(['Незнакомец', 'Знакомый', 'Приятель', 'Друг', 'Верный друг']);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].at).toBeGreaterThan(RANKS[i - 1].at);
    expect(RANKS.map((r) => r.discount)).toEqual([0, 0, 0.05, 0.1, 0.15]);
  });
  it('ступень и следующая по очкам', () => {
    expect([0, 1, 2, 4, 5, 9, 10, 19, 20, 99].map((p) => rankOf(p).id)).toEqual([
      'stranger', 'stranger', 'acquaintance', 'acquaintance', 'pal', 'pal', 'friend', 'friend', 'loyal', 'loyal',
    ]);
    expect(nextRank(3)).toEqual({ rank: RANKS[2], left: 2 });
    expect(nextRank(25)).toBeNull();
  });
  it('скидка на улучшение здания', () => {
    expect(discountedCost(200, 0)).toBe(200);
    expect(discountedCost(200, 5)).toBe(190);
    expect(discountedCost(200, 10)).toBe(180);
    expect(discountedCost(330, 20)).toBe(281);
  });
  it('тёплые приветствия с Приятеля', () => {
    const warm = ['pal', 'friend', 'loyal'];
    expect([0, 3, 5, 12, 40].map((p) => greetingFor('base', warm, p))).toEqual(['base', 'base', 'pal', 'friend', 'loyal']);
  });
  it('друзья города и миссии', () => {
    expect(friendsCount({ a: 10, b: 9, c: 25 })).toBe(2);
    expect(missionOpen(50)).toBe(false);
  });
});
