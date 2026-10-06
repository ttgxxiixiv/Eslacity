import { describe, expect, it } from 'vitest';
import type { Word } from '../content/schema';
import { isLearned, isWordLevelOpen, lessonParts, MAX_BUILDING_LEVEL, wordLevelCap } from './levels';

const ws = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `cafe.w${i}` }) as Word);

describe('lessonParts', () => {
  it('делит уровень на уроки не больше 6 слов примерно поровну', () => {
    expect(lessonParts(ws(10)).map((p) => p.length)).toEqual([5, 5]);
    expect(lessonParts(ws(11)).map((p) => p.length)).toEqual([6, 5]);
    expect(lessonParts(ws(12)).map((p) => p.length)).toEqual([6, 6]);
    expect(lessonParts([])).toEqual([]);
  });
  it('уровень выучен, когда у всех слов есть карточки', () => {
    expect(isLearned(ws(2), { 'cafe.w0': 1 })).toBe(false);
    expect(isLearned(ws(2), { 'cafe.w0': 1, 'cafe.w1': 1 })).toBe(true);
  });
});

describe('уровни слов выше здания', () => {
  const ws = Array.from({ length: 12 }, (_, i) => ({ id: `cafe.w${i}`, level: i < 6 ? 5 : 6 }) as Word);
  const five = Object.fromEntries(ws.slice(0, 6).map((w) => [w.id, {}]));
  it('до 5-го — по уровню здания, 6-й — у здания 5-го уровня после уровня 5', () => {
    expect(isWordLevelOpen(3, 3, ws, {})).toBe(true);
    expect(isWordLevelOpen(4, 3, ws, {})).toBe(false);
    expect(isWordLevelOpen(6, 5, ws, {})).toBe(false);
    expect(isWordLevelOpen(6, 5, ws, five)).toBe(true);
    expect(isWordLevelOpen(6, 4, ws, five)).toBe(false);
    expect(wordLevelCap(4, ws)).toBe(4);
    expect(wordLevelCap(5, ws)).toBe(6);
    expect(MAX_BUILDING_LEVEL).toBe(5);
  });
  it('начатый уровень не закрывается, если на предыдущий переехало новое слово', () => {
    const moved = [...ws, { id: 'cafe.new', level: 5 } as Word];
    expect(isWordLevelOpen(6, 5, moved, five)).toBe(false);
    expect(isWordLevelOpen(6, 5, moved, { ...five, 'cafe.w7': {} })).toBe(true);
    expect(isWordLevelOpen(6, 4, moved, { ...five, 'cafe.w7': {} })).toBe(false);
  });
});
