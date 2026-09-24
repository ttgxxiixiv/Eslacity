import { describe, expect, it } from 'vitest';
import type { Word } from '../content/schema';
import { isLearned, lessonParts } from './levels';

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
