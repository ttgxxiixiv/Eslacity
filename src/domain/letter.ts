/**
 * Письмо с образцом (задача 7.7, docs/GAME.md): свободный текст без автоматической оценки. Герой пишет 40–80 слов,
 * затем сравнивает с образцом и сам отмечает пункты чек-листа. Опыт даётся за первое письмо каждой просьбы;
 * путь (обрывки, испытания) от писем не зависит. Все написанные письма хранятся в «Дневнике писем».
 */

export const LETTER_MIN_WORDS = 40;
export const LETTER_MAX_WORDS = 80;
/** Опыт за первое письмо по просьбе жителя. */
export const LETTER_XP = 40;

/** Слова текста: всё, что разделено пробелами и содержит букву. «l'addebito» — одно слово, «5» и «—» — не слова. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((t) => /\p{L}/u.test(t)).length;
}

/** Можно ли отправить письмо: не короче минимума (длиннее — можно, но подсказка скажет, что образец короче). */
export const canSend = (text: string) => wordCount(text) >= LETTER_MIN_WORDS;

export interface LetterEntry {
  /** id просьбы (`lt:bank`). */
  letterId: string;
  text: string;
  /** Отмеченные пункты чек-листа (номера). */
  checks: number[];
  at: number;
}

/** Опыт за письмо: только за первое по этой просьбе. */
export function letterXp(entries: LetterEntry[], letterId: string): number {
  return entries.some((e) => e.letterId === letterId) ? 0 : LETTER_XP;
}
