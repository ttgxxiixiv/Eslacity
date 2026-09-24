import type { Word } from '../content/schema';
import { LESSON } from '../config';

export function levelWords(words: Word[], level: number): Word[] {
  return words.filter((w) => w.level === level);
}

export function maxContentLevel(words: Word[]): number {
  return words.reduce((m, w) => Math.max(m, w.level), 0);
}

/** Слова уровня делятся на уроки не больше 6 слов, примерно поровну: 11 → 6 + 5. */
export function lessonParts(words: Word[]): Word[][] {
  if (!words.length) return [];
  const parts = Math.ceil(words.length / LESSON.maxWordsPerLesson);
  const size = Math.ceil(words.length / parts);
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

export function isLearned(words: Word[], cards: Record<string, unknown>): boolean {
  return words.length > 0 && words.every((w) => w.id in cards);
}

export function learnedCount(words: Word[], cards: Record<string, unknown>): number {
  return words.filter((w) => w.id in cards).length;
}
