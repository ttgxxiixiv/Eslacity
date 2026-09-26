import { describe, expect, it } from 'vitest';
import { exerciseOf, isRuleId, lessonOfExercise, ruleCardId, splitCards, wordCards, wordIds } from './itemId';
import { grammarItemId } from './answerLog';
import { vocabulary } from './vocabulary';
import { recentLocation } from './next';

const card = (wordId: string, extra = {}) => ({ wordId, interval: 30, stability: 30, learnedAt: 1, ...extra });

describe('карточки слов и правил', () => {
  it('id правила: префикс g:, совпадает с записью журнала, разбирается обратно', () => {
    expect(ruleCardId('a1.02-ser.3')).toBe('g:a1.02-ser.3');
    expect(ruleCardId('a1.02-ser.3')).toBe(grammarItemId('a1.02-ser.3'));
    expect(exerciseOf('g:a1.02-ser.3')).toBe('a1.02-ser.3');
    expect(lessonOfExercise('b11.04-futuro-irregular.12')).toBe('b11.04-futuro-irregular');
    expect(isRuleId('g:a1.02-ser.3')).toBe(true);
    expect(isRuleId('cafe.te')).toBe(false);
  });

  it('разделение и фильтры', () => {
    const list = [card('cafe.te'), card('g:a1.02-ser.1'), card('market.tomate')];
    const { words, rules } = splitCards(list);
    expect(words.map((c) => c.wordId)).toEqual(['cafe.te', 'market.tomate']);
    expect(rules.map((c) => c.wordId)).toEqual(['g:a1.02-ser.1']);
    const rec = Object.fromEntries(list.map((c) => [c.wordId, c]));
    expect(Object.keys(wordCards(rec))).toEqual(['cafe.te', 'market.tomate']);
    expect(wordIds(Object.keys(rec))).toEqual(['cafe.te', 'market.tomate']);
  });

  it('правила не входят в словарный запас и не считаются последним местом', () => {
    const rec = {
      'cafe.te': card('cafe.te', { learnedAt: 1 }),
      'g:a1.02-ser.1': card('g:a1.02-ser.1', { learnedAt: 99 }),
    };
    expect(vocabulary(rec, () => false)).toEqual({ learned: 1, solid: 1 });
    expect(recentLocation(rec)).toBe('cafe');
  });
});
