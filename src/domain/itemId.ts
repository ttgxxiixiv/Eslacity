/**
 * Карточки в таблице `cards` бывают двух видов: слова (`cafe.te`) и правила — упражнения грамматики
 * (`g:a1.02-ser.3`). Всё, что считает слова, берёт только карточки слов; экран повторения ищет слова
 * и упражнения по-разному и не удаляет правила как «слова, которых нет в контенте».
 */

export const RULE_PREFIX = 'g:';

export const isRuleId = (id: string): boolean => id.startsWith(RULE_PREFIX);

/** Id карточки правила по id упражнения: тот же вид, что и запись в журнале ответов. */
export const ruleCardId = (exerciseId: string): string => `${RULE_PREFIX}${exerciseId}`;

/** Id упражнения по id карточки правила. */
export const exerciseOf = (cardId: string): string => cardId.slice(RULE_PREFIX.length);

/** Урок упражнения: `a1.02-ser.3` → `a1.02-ser`. */
export const lessonOfExercise = (exerciseId: string): string => exerciseId.slice(0, exerciseId.lastIndexOf('.'));

/** Разделить карточки на слова и правила. */
export function splitCards<T extends { wordId: string }>(cards: Iterable<T>): { words: T[]; rules: T[] } {
  const words: T[] = [];
  const rules: T[] = [];
  for (const c of cards) (isRuleId(c.wordId) ? rules : words).push(c);
  return { words, rules };
}

/** Только карточки слов из словаря карточек. */
export function wordCards<T>(cards: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(cards).filter(([id]) => !isRuleId(id)));
}

/** id слов среди id карточек. */
export const wordIds = (ids: Iterable<string>): string[] => [...ids].filter((id) => !isRuleId(id));
