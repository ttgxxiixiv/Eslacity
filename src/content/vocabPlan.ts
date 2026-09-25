/**
 * План словаря на весь путь (docs/GAME.md, раздел «Словарный запас»). Числа одинаковые для обоих языков.
 * Слова мест считаются по уровням мест, слова свитков — по землям. Устойчивые выражения в цель не входят.
 */

/** Цель: столько слов в словаре к победе над Сфинксом. */
export const VOCAB_GOAL = 3000;

export interface ChapterPlan {
  chapter: 'I' | 'II' | 'III' | 'IV' | 'V';
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  /** Уровни мест, слова которых открывает глава. */
  levels: number[];
  /** Слов мест за главу (на все 20 мест). */
  places: number;
  /** Слов в свитке земли. */
  scroll: number;
}

export const CHAPTERS: ChapterPlan[] = [
  { chapter: 'I', cefr: 'A1', levels: [1, 2], places: 445, scroll: 60 },
  { chapter: 'II', cefr: 'A2', levels: [3, 4], places: 474, scroll: 100 },
  { chapter: 'III', cefr: 'B1', levels: [5], places: 600, scroll: 150 },
  { chapter: 'IV', cefr: 'B2', levels: [6], places: 600, scroll: 150 },
  { chapter: 'V', cefr: 'C1', levels: [7], places: 500, scroll: 150 },
];

/** Всего слов по плану: 3229, запас над целью на повторы и замены. */
export const PLAN_TOTAL = CHAPTERS.reduce((n, c) => n + c.places + c.scroll, 0);

/** Наибольшее число слов в одном уровне одного места. */
export const PLACE_LEVEL_MAX: Record<number, number> = { 1: 12, 2: 12, 3: 12, 4: 12, 5: 30, 6: 30, 7: 25 };

/** Устойчивых выражений на уровне 7 одного места (в цель 3000 не входят). */
export const PLACE_EXPRESSIONS = 15;

/** Глава, к которой относится уровень места. */
export function chapterOfLevel(level: number): ChapterPlan | undefined {
  return CHAPTERS.find((c) => c.levels.includes(level));
}

/** Цели покрытия частотного списка к концу пути. */
export const COVERAGE_GOAL = { top1000: 0.9, top3000: 0.7 };
