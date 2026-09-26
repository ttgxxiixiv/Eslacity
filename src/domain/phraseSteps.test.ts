import { describe, expect, it } from 'vitest';
import type { Phrase } from '../content/schema';
import { checkPhrase } from './answer';
import { seeded } from './generators';
import { EXTRA_TILES, learnPhraseSteps, lowerGrade, makeOptions, makeTiles, phraseTokens, reviewPhraseSteps } from './phraseSteps';

const ph = (slug: string, es: string): Phrase => ({ id: `ph:cafe.${slug}`, es, ru: slug, level: 1 });
const pool = [
  ph('cafe', 'Un café, por favor.'),
  ph('cuenta', 'La cuenta, por favor.'),
  ph('te', '(Yo) quiero un té con leche.'),
  ph('agua', 'Un vaso de agua, por favor.'),
  ph('azucar', 'Sin azúcar, gracias.'),
];

describe('задания фраз', () => {
  it('плитки: слова полной фразы без знаков и две лишних из других фраз', () => {
    expect(phraseTokens('(Yo) quiero un té con leche.')).toEqual(['yo', 'quiero', 'un', 'té', 'con', 'leche']);
    expect(phraseTokens('Aquí tiene mi DNI.')).toEqual(['aquí', 'tiene', 'mi', 'DNI']);
    expect(phraseTokens('DNI, por favor')[0]).toBe('DNI');
    const tiles = makeTiles(pool[2], pool, seeded(1));
    expect(tiles).toHaveLength(6 + EXTRA_TILES);
    const extra = tiles.filter((t) => !phraseTokens(pool[2].es).includes(t));
    expect(extra).toHaveLength(EXTRA_TILES);
    // Собранная из своих плиток фраза проходит проверку, и без необязательного «Yo» тоже.
    expect(checkPhrase(phraseTokens(pool[2].es).join(' '), pool[2]).verdict).toBe('correct');
    expect(checkPhrase(phraseTokens(pool[2].es).slice(1).join(' '), pool[2]).verdict).toBe('correct');
  });
  it('выбор: верная фраза и три другие', () => {
    const opts = makeOptions(pool[0], pool, seeded(2));
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain(pool[0].id);
  });
  it('урок: знакомство, выбор, сборка, ввод по каждой фразе', () => {
    const steps = learnPhraseSteps(pool.slice(0, 3), pool, seeded(3));
    expect(steps.map((s) => s.kind)).toEqual([
      'intro', 'intro', 'intro', 'choose', 'choose', 'choose', 'tiles', 'tiles', 'tiles', 'type', 'type', 'type',
    ]);
  });
  it('повторение: молодая фраза — плитки, закрепившаяся — ввод', () => {
    const cards = { [pool[0].id]: { stability: 2 }, [pool[1].id]: { stability: 30 } } as never;
    const steps = reviewPhraseSteps(pool.slice(0, 2), cards, pool, seeded(4));
    expect(Object.fromEntries(steps.map((s) => [s.id, s.kind]))).toEqual({ [pool[0].id]: 'tiles', [pool[1].id]: 'type' });
  });
  it('оценка — худшая за сессию', () => {
    const g = {};
    lowerGrade(g, 'a', 'correct', true);
    lowerGrade(g, 'a', 'almost', false);
    expect(g).toEqual({ a: 3 });
  });
});
