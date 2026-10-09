import type { NoteMust } from '../content/schema';
import { wordCount, type LetterEntry } from './letter';

/**
 * Записка жителю (задача 12.5, docs/GAME.md): короткое письмо с главы II. Проверка частичная, без сервера:
 * в записке ищутся ключевые слова и формы из списка `must`, на пропущенное даётся подсказка. Опыт — за первую
 * записку, где есть всё из списка. Записки лежат в том же дневнике, что и письма (`meta.letters`).
 */

/** Слов в записке героя: не меньше, иначе это не записка. Образец — 15–30. */
export const NOTE_MIN_WORDS = 10;
export const NOTE_SAMPLE_WORDS = [15, 30] as const;
/** Опыт за первую полную записку по просьбе. */
export const NOTE_XP = 20;

/** Строчные буквы без ударений, всё остальное — пробелы: «¡Mañana voy!» → « manana voy ». */
const plain = (s: string) =>
  ` ${s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}]+/gu, ' ').trim()} `;

/** Слова текста строчными, с ударениями: для окончаний, где ударение и есть признак формы (vendré, verrò). */
const words = (s: string) => s.toLowerCase().normalize('NFC').split(/[^\p{L}\p{M}]+/u).filter(Boolean);

/** Есть ли в тексте вариант: слово или сочетание целиком, `*окончание` — у какого-нибудь слова. */
export function hasVariant(text: string, variant: string): boolean {
  if (variant.startsWith('*')) {
    const end = variant.slice(1).toLowerCase().normalize('NFC');
    return words(text).some((w) => w.length > end.length && w.endsWith(end));
  }
  return plain(text).includes(plain(variant));
}

export interface NoteCheck {
  /** Номера найденных пунктов `must`. */
  found: number[];
  /** Номера пропущенных. */
  missing: number[];
}

/** Что из списка `must` есть в записке. */
export function checkNote(text: string, must: NoteMust[]): NoteCheck {
  const found: number[] = [];
  const missing: number[] = [];
  must.forEach((m, i) => (m.any.some((v) => hasVariant(text, v)) ? found : missing).push(i));
  return { found, missing };
}

export const canSendNote = (text: string) => wordCount(text) >= NOTE_MIN_WORDS;

/** Опыт за записку: только за первую, где есть всё из списка (в записи дневника `checks` — найденные пункты). */
export function noteXp(entries: LetterEntry[], noteId: string, must: number, check: NoteCheck): number {
  if (check.missing.length) return 0;
  return entries.some((e) => e.letterId === noteId && e.checks.length === must) ? 0 : NOTE_XP;
}
