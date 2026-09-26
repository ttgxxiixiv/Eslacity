import { describe, expect, it } from 'vitest';
import { CHAPTER_MARKS, SCALE_MAX, VOCAB_GOAL, vocabulary } from './vocabulary';

describe('словарный запас', () => {
  it('считает слова без фраз, закреплённые — с интервалом от 21 дня', () => {
    const cards = {
      'cafe.cafe': { interval: 30 },
      'cafe.te': { interval: 21 },
      'cafe.leche': { interval: 20 },
      'cafe.la_cuenta_por_favor': { interval: 40 },
      'market.tomate': { interval: 1 },
    };
    expect(vocabulary(cards, (id) => id === 'cafe.la_cuenta_por_favor')).toEqual({ learned: 4, solid: 2 });
    expect(vocabulary({}, () => false)).toEqual({ learned: 0, solid: 0 });
  });

  it('отметки глав по плану и цель 3000', () => {
    expect(CHAPTER_MARKS.map((m) => m.at)).toEqual([505, 1079, 1829, 2579, 3229]);
    expect(SCALE_MAX).toBe(3229);
    expect(VOCAB_GOAL).toBe(3000);
  });
});
