import { describe, expect, it } from 'vitest';
import { isExpression, typeable, wordTags } from './expression';

describe('метки выражений', () => {
  it('у обычного слова меток нет', () => {
    expect(wordTags({})).toEqual([]);
    expect(isExpression({})).toBe(false);
  });
  it('идиома и ложный друг помечены, сочетание и формула нет', () => {
    expect(wordTags({ kind: 'idiom', register: 'informal' })).toEqual(['идиома', 'разговорно']);
    expect(wordTags({ kind: 'false-friend', register: 'neutral' })).toEqual(['ложный друг']);
    expect(wordTags({ kind: 'collocation', register: 'neutral' })).toEqual([]);
    expect(wordTags({ kind: 'formula', register: 'formal' })).toEqual(['официально']);
    expect(isExpression({ kind: 'formula' })).toBe(true);
  });
  it('регистр виден и у слова без вида', () => {
    expect(wordTags({ register: 'formal' })).toEqual(['официально']);
  });
});

describe('пометки употребления (задача 15.2)', () => {
  it('метка идёт первой, грубое слово нельзя вводить', () => {
    expect(wordTags({ usage: 'slang', kind: 'collocation', register: 'informal' })).toEqual(['сленг', 'разговорно']);
    expect(wordTags({ usage: 'regional' })).toEqual(['региональное']);
    expect(typeable({ usage: 'vulgar' })).toBe(false);
    expect(typeable({ usage: 'slang' })).toBe(true);
    expect(typeable({})).toBe(true);
  });
});
