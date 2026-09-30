import { describe, expect, it } from 'vitest';
import { drinkElixir, isVaultOpen, journeySummary } from './elixir';
import { EMPTY_SPHINX } from './sphinx';

const DAY = 86_400_000;

describe('Эликсир', () => {
  it('пить можно только в открытом Хранилище и один раз', () => {
    expect(isVaultOpen(EMPTY_SPHINX)).toBe(false);
    expect(drinkElixir(EMPTY_SPHINX, 5)).toBe(EMPTY_SPHINX);
    const open = { ...EMPTY_SPHINX, done: 1 };
    const drunk = drinkElixir(open, 5);
    expect(drunk.elixir).toBe(5);
    expect(drinkElixir(drunk, 9)).toBe(drunk);
  });
});

describe('итоги пути', () => {
  it('слова и выражения отдельно, без фраз, правил и глаголов; дни от первого слова', () => {
    const end = 100 * DAY + 5;
    const s = journeySummary({
      cards: {
        'cafe.te': { learnedAt: 10 * DAY },
        'bank.a-la-orden': { learnedAt: 90 * DAY },
        'ph:cafe.un-cafe': { learnedAt: 1 },
        'g:a1.02-ser.3': { learnedAt: 1 },
        'v:hablar.presente.3': { learnedAt: 1 },
        'scroll1.casa': { learnedAt: 20 * DAY },
        'cafe.en-frase': { learnedAt: 20 * DAY },
      },
      // Выражения в индексе фраз тоже есть (часть речи phrase), но считаются выражениями.
      isPhrase: (id) => id.startsWith('ph:') || id === 'bank.a-la-orden' || id === 'cafe.en-frase',
      isExpression: (id) => id === 'bank.a-la-orden',
      activeDays: 70,
      medals: { lines: { words: { wood: 1, stone: 2 }, trials: { wood: 3 } }, secrets: { sphinx: 1, keeper: 2 } },
      missions: { 'ms:cafe.1': { done: 1 }, 'ms:bank.1': {} },
      seals: { 1: 11, 2: 22, 5: 55 },
      end,
    });
    expect(s).toMatchObject({ days: 91, activeDays: 70, words: 2, expressions: 1, medals: 5, missions: 1 });
    expect(s.seals.map((x) => [x.roman, x.at])).toEqual([['I', 11], ['II', 22], ['III', undefined], ['IV', undefined], ['V', 55]]);
  });
});
