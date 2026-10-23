import { describe, expect, it } from 'vitest';
import { knownCard, newCard } from './srs';
import { TRAPS_DAYS, TRAPS_FLOOR, TRAPS_SIZE, trapsDue, trapsPlan } from './traps';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 1);

describe('ловушки русского (задача 21.4)', () => {
  it('поручение раз в неделю', () => {
    expect(trapsDue(0, 20_000)).toBe(true);
    expect(trapsDue(20_000, 20_000 + TRAPS_DAYS - 1)).toBe(false);
    expect(trapsDue(20_000, 20_000 + TRAPS_DAYS)).toBe(true);
  });

  it('только выученные ловушки, не меньше порога', () => {
    const ids = ['a.x', 'a.y', 'a.z', 'a.w'];
    const cards = Object.fromEntries(ids.slice(0, TRAPS_FLOOR - 1).map((id) => [id, knownCard(id, NOW, 10)]));
    expect(trapsPlan(ids, cards, NOW)).toBeNull();
    cards['a.w'] = knownCard('a.w', NOW, 10);
    const plan = trapsPlan(ids, cards, NOW)!;
    expect(plan.words.sort()).toEqual(['a.w', 'a.x', 'a.y']);
    expect(plan.rules).toEqual([]);
  });

  it('сначала забытые, не больше TRAPS_SIZE, выбор и ввод вперемешку', () => {
    const ids = Array.from({ length: TRAPS_SIZE + 4 }, (_, i) => `a.w${i}`);
    const cards = Object.fromEntries(ids.map((id, i) => [id, knownCard(id, NOW - (i === 5 ? 60 : 1) * DAY, 3)]));
    cards['a.w7'] = newCard('a.w7', NOW);
    const plan = trapsPlan(ids, cards, NOW)!;
    expect(plan.words).toHaveLength(TRAPS_SIZE);
    // Новая карточка (вероятность 0) и давно не виденная идут первыми.
    expect(plan.words.slice(0, 2)).toEqual(['a.w7', 'a.w5']);
    expect(plan.kinds[plan.words[0]]).toBe('choice-es-ru');
    expect(plan.kinds[plan.words[1]]).toBe('type');
  });
});
