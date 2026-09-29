import { describe, expect, it } from 'vitest';
import { canSend, LETTER_XP, letterXp, wordCount } from './letter';

describe('письмо с образцом', () => {
  it('считает слова: апостроф внутри слова, числа и тире не слова', () => {
    expect(wordCount('Gentile dottor Ferri,\nLe scrivo per l\'addebito del 3 maggio — grazie.')).toBe(10);
    expect(wordCount('  ')).toBe(0);
  });
  it('отправить можно с сорока слов, длиннее восьмидесяти — тоже', () => {
    expect(canSend(Array(39).fill('palabra').join(' '))).toBe(false);
    expect(canSend(Array(40).fill('palabra').join(' '))).toBe(true);
    expect(canSend(Array(120).fill('palabra').join(' '))).toBe(true);
  });
  it('опыт только за первое письмо по просьбе', () => {
    expect(letterXp([], 'lt:bank')).toBe(LETTER_XP);
    expect(letterXp([{ letterId: 'lt:bank', text: 'x', checks: [], at: 1 }], 'lt:bank')).toBe(0);
    expect(letterXp([{ letterId: 'lt:bank', text: 'x', checks: [], at: 1 }], 'lt:cafe')).toBe(LETTER_XP);
  });
});
