/**
 * Карточки в таблице `cards` бывают трёх видов: слова (`cafe.te`), правила — упражнения грамматики
 * (`g:a1.02-ser.3`) и фразы мест (`ph:cafe.un-cafe`, id карточки совпадает с id фразы). Всё, что считает
 * слова, берёт только карточки слов; экран повторения ищет слова, упражнения и фразы по-разному
 * и не удаляет правила и фразы как «слова, которых нет в контенте».
 */

export const RULE_PREFIX = 'g:';

export const isRuleId = (id: string): boolean => id.startsWith(RULE_PREFIX);

export const PHRASE_CARD_PREFIX = 'ph:';

/** Карточка фразы места: `ph:cafe.un-cafe`. */
export const isPhraseId = (id: string): boolean => id.startsWith(PHRASE_CARD_PREFIX);

/** Карточка слова: не правило и не фраза. */
export const isWordId = (id: string): boolean => !isRuleId(id) && !isPhraseId(id);

/** Место фразы: `ph:cafe.un-cafe` → `cafe`. */
export const placeOfPhrase = (id: string): string => id.slice(PHRASE_CARD_PREFIX.length).split('.')[0];

/** Id карточки правила по id упражнения: тот же вид, что и запись в журнале ответов. */
export const ruleCardId = (exerciseId: string): string => `${RULE_PREFIX}${exerciseId}`;

/** Id упражнения по id карточки правила. */
export const exerciseOf = (cardId: string): string => cardId.slice(RULE_PREFIX.length);

/** Урок упражнения: `a1.02-ser.3` → `a1.02-ser`. */
export const lessonOfExercise = (exerciseId: string): string => exerciseId.slice(0, exerciseId.lastIndexOf('.'));

/** Разделить карточки на слова, правила и фразы. */
export function splitCards<T extends { wordId: string }>(cards: Iterable<T>): { words: T[]; rules: T[]; phrases: T[] } {
  const words: T[] = [];
  const rules: T[] = [];
  const phrases: T[] = [];
  for (const c of cards) (isRuleId(c.wordId) ? rules : isPhraseId(c.wordId) ? phrases : words).push(c);
  return { words, rules, phrases };
}

/** Только карточки слов из словаря карточек. */
export function wordCards<T>(cards: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(cards).filter(([id]) => isWordId(id)));
}

/** id слов среди id карточек. */
export const wordIds = (ids: Iterable<string>): string[] => [...ids].filter(isWordId);

/** Слова свитков земель: `scroll1.mapa`. Свиток главы загружается как отдельное «место» `scroll1`. */
export const isScrollId = (id: string): boolean => /^scroll\d+(\.|$)/.test(id);

/** Ключ свитка главы: `scroll1`. */
export const scrollKey = (chapter: number) => `scroll${chapter}` as const;
