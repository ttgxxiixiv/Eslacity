import { CHAPTERS, PLAN_TOTAL, VOCAB_GOAL } from '../content/vocabPlan';
import { isWordId } from './itemId';
import { SOLID_INTERVAL_DAYS } from './medals';

/**
 * Словарный запас героя (docs/GAME.md, «Словарный запас в игре»): выученные слова мест и свитков
 * без фраз, выражений и правил, и сколько из них закреплено.
 */
export interface Vocabulary {
  learned: number;
  /** Помнится надёжно: стабильность FSRS не меньше 21 дня. */
  solid: number;
}

export function vocabulary(cards: Record<string, { stability?: number; interval: number }>, isPhrase: (id: string) => boolean): Vocabulary {
  let learned = 0;
  let solid = 0;
  for (const [id, c] of Object.entries(cards)) {
    // Правила грамматики (карточки g:), фразы мест (карточки ph:) и слова-выражения в запас не входят.
    if (!isWordId(id) || isPhrase(id)) continue;
    learned++;
    // Карточка без стабильности (до переноса на FSRS) считается по интервалу.
    if ((c.stability ?? c.interval) >= SOLID_INTERVAL_DAYS) solid++;
  }
  return { learned, solid };
}

/** Отметки конца глав на полосе: 505, 1079, 1829, 2579, 3229 (накопительно по плану). */
export const CHAPTER_MARKS: { chapter: string; at: number }[] = CHAPTERS.reduce<{ chapter: string; at: number }[]>(
  (acc, c) => [...acc, { chapter: c.chapter, at: (acc.at(-1)?.at ?? 0) + c.places + c.scroll }],
  [],
);

/** Шкала полосы: до конца плана, цель отмечена отдельно. */
export const SCALE_MAX = PLAN_TOTAL;
export { VOCAB_GOAL };
