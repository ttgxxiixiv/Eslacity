/**
 * Пролог (задача 13.2): первые минуты игры. Путник у ворот, Привратник учит трём словам, ведёт к кафе,
 * житель кафе ждёт три ответа выбором, в конце — обрывок пролога (отдельный, в 100 обрывков глав не входит).
 * Контент — `src/content/<язык>/prologue.json`, экран — `/prologue`.
 */

export interface PrologueRecord {
  /** Пролог пройден до конца. */
  done?: number;
  /** Путник пропустил пролог. */
  skipped?: number;
  /** Обрывок пролога получен. */
  shard?: number;
}

export const EMPTY_PROLOGUE: PrologueRecord = {};

/** Слов в прологе: приветствие, «спасибо», прощание. */
export const PROLOGUE_WORDS = 3;

/** Шаги пролога по порядку. */
export const PROLOGUE_STEPS = ['gate', 'words', 'road', 'mission', 'shard'] as const;
export type PrologueStep = (typeof PROLOGUE_STEPS)[number];

/** Пролог ещё впереди: не пройден и не пропущен. */
export const prologuePending = (r: PrologueRecord): boolean => r.done === undefined && r.skipped === undefined;

/** Запись пролога для тех, кто начал до 2.130.0: пролог им не показывается, обрывка нет. */
export const legacyPrologue = (r: PrologueRecord | undefined, hasProgress: boolean, now: number): PrologueRecord =>
  r ?? (hasProgress ? { done: now } : EMPTY_PROLOGUE);

export interface HomeBlocks {
  /** Полоса пути (обрывки глав). */
  journey: boolean;
  /** Повторение. */
  review: boolean;
  /** Следующий урок грамматики. */
  grammar: boolean;
  /** Блиц. */
  blitz: boolean;
}

/** Блиц и грамматика появляются, когда в запасе столько слов (или пройден урок). */
export const HOME_UNLOCK_WORDS = 10;

/**
 * Какие блоки показать на главной (задача 13.2): у новичка — только «Продолжить», остальное появляется по мере
 * открытия: путь и повторение — с первого слова, грамматика и блиц — с десяти слов (грамматика — и с первого урока).
 */
export function homeBlocks(learned: number, cards: number, lessonsDone: number): HomeBlocks {
  return {
    journey: learned > 0 || lessonsDone > 0,
    review: cards > 0,
    grammar: learned >= HOME_UNLOCK_WORDS || lessonsDone > 0,
    blitz: learned >= HOME_UNLOCK_WORDS,
  };
}
