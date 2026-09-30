import { describe, expect, it } from 'vitest';
import type { GrammarExercise, Word } from '../content/schema';
import { seeded } from './generators';
import { blockPassed, knownDays, placementBlock, placementGrant, placementOffered, PLACEMENT_RULES, PLACEMENT_WORDS } from './placement';
import { knownCard, retrievability } from './srs';

const word = (i: number, kind?: string): Word =>
  ({ id: kind ? `cafe.expr${i}` : `cafe.w${i}`, es: `palabra${i}`, ru: `слово${i}`, pos: 'noun', level: 1, example: { es: 'x', ru: 'x' }, ...(kind ? { kind } : {}) }) as Word;
const words = [...Array.from({ length: 12 }, (_, i) => word(i)), word(100, 'idiom'), word(101, 'idiom')];
const lesson = (l: number): GrammarExercise[] => [
  { id: `a1.l${l}.1`, kind: 'choose', prompt: `p${l}`, options: ['a', 'b'], answer: 0, explain: '' },
  { id: `a1.l${l}.2`, kind: 'truefalse', statement: `s${l}`, answer: true, explain: '' },
  { id: `a1.l${l}.3`, kind: 'build', ru: 'x', answer: 'a b', extra: [], explain: '' },
];

describe('входной тест', () => {
  it('блок: 6 слов без выражений, 4 правила с выбором из разных уроков', () => {
    const items = placementBlock(words, [1, 2, 3, 4, 5, 6].map(lesson), seeded(7));
    const ws = items.filter((i) => i.kind === 'word');
    const gs = items.flatMap((i) => (i.kind === 'grammar' ? [i.item.ex] : []));
    expect(ws).toHaveLength(PLACEMENT_WORDS);
    expect(ws.every((i) => i.kind === 'word' && !(i.step as { wordId: string }).wordId.startsWith('cafe.expr'))).toBe(true);
    expect(ws.filter((i) => i.kind === 'word' && i.step.kind === 'type')).toHaveLength(1);
    expect(gs).toHaveLength(PLACEMENT_RULES);
    expect(gs.every((e) => e.kind === 'choose' || e.kind === 'truefalse')).toBe(true);
    expect(new Set(gs.map((e) => e.id.split('.').slice(0, 2).join('.'))).size).toBe(PLACEMENT_RULES);
  });

  it('блок засчитан при 80%', () => {
    expect(blockPassed(8, 10)).toBe(true);
    expect(blockPassed(7, 10)).toBe(false);
    expect(blockPassed(0, 0)).toBe(false);
  });

  it('засчитанные главы: обрывки, печати до IV, уровень зданий', () => {
    expect(placementGrant(0)).toEqual({ fragmentChapters: [], sealChapters: [], buildingLevel: 0 });
    expect(placementGrant(2)).toEqual({ fragmentChapters: [1, 2], sealChapters: [1, 2], buildingLevel: 4 });
    expect(placementGrant(3).buildingLevel).toBe(5);
    // Печать главы V — только от Хозяина Эха: Врата тест не открывает.
    expect(placementGrant(5)).toEqual({ fragmentChapters: [1, 2, 3, 4, 5], sealChapters: [1, 2, 3, 4], buildingLevel: 5 });
  });

  it('предлагается только в начале курса и пока путник не решил', () => {
    expect(placementOffered({}, 0)).toBe(true);
    expect(placementOffered({}, 3)).toBe(false);
    expect(placementOffered({ skipped: 1 }, 0)).toBe(false);
    expect(placementOffered({ done: 1, passed: 0 }, 0)).toBe(false);
  });

  it('названное слово — карточка на повторении с увеличенной стабильностью', () => {
    const now = new Date(2026, 8, 30, 12).getTime();
    const c = knownCard('cafe.te', now, knownDays(3));
    expect(c.stability).toBe(13);
    expect(retrievability(c, now)).toBeCloseTo(1, 3);
    expect(retrievability(c, now + 13 * 86_400_000)).toBeCloseTo(0.9, 2);
    expect(new Set(Array.from({ length: 30 }, (_, i) => knownDays(i))).size).toBe(11);
  });
});
