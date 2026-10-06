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

/** Здание растёт до 5-го уровня. Слова уровней выше (6 — глава IV) открываются без улучшения здания. */
export const MAX_BUILDING_LEVEL = 5;

/**
 * Открыт ли уровень слов в здании (без учёта главы). До 5-го — по уровню здания. Выше — у здания 5-го уровня,
 * когда выучены все слова предыдущего уровня: это заменяет улучшение, которого у здания больше нет.
 * Уровень, где уже есть выученные слова, открыт всегда: слова переезжают между уровнями (задача 12.1),
 * и новое слово на предыдущем уровне не должно закрывать начатое.
 */
export function isWordLevelOpen(level: number, buildingLevel: number, words: Word[], cards: Record<string, unknown>): boolean {
  if (level <= MAX_BUILDING_LEVEL) return level <= buildingLevel;
  if (buildingLevel < MAX_BUILDING_LEVEL) return false;
  return isLearned(levelWords(words, level - 1), cards) || levelWords(words, level).some((w) => w.id in cards);
}

/** Самый высокий уровень слов, который может открыться в здании этого уровня. */
export const wordLevelCap = (buildingLevel: number, words: Word[]) =>
  buildingLevel >= MAX_BUILDING_LEVEL ? Math.max(buildingLevel, maxContentLevel(words)) : buildingLevel;
