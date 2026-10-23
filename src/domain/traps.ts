import type { StepKind } from './lessonQueue';
import type { MistakesPlan } from './mistakes';
import { retrievability, type SrsCard } from './srs';

/**
 * Ловушки для русскоговорящих (задача 21.4). У слова может быть поле `ruTrap`: чем русский мешает (ложный друг,
 * род не как в русском, артикль, которого в русском нет). Раз в неделю Летописец даёт поручение «Ловушки» —
 * повторение уже выученных слов с такой пометкой. Чистые функции: id слов-ловушек и карточки передаются снаружи.
 */

/** Поручение бывает раз в столько дней. */
export const TRAPS_DAYS = 7;
/** Заданий в «Ловушках». */
export const TRAPS_SIZE = 10;
/** Меньше стольких выученных ловушек поручения нет. */
export const TRAPS_FLOOR = 3;

/** Просьба Летописца: {n} — число слов. */
export const TRAPS_TEXT = 'Русский язык подсказывает тебе неправду, путник. Проверим {n} {слов}, где он уже подставлял тебе ногу.';

/** Пора ли поручение: прошла неделя с прошлых «Ловушек» (`last` — номер дня, 0 — ещё не было). */
export function trapsDue(last: number, today: number): boolean {
  return today - last >= TRAPS_DAYS;
}

/**
 * Слова «Ловушек»: выученные ловушки, сначала те, что помнятся хуже. Вид задания чередуется: выбор перевода
 * (узнать ложного друга) и ввод (сказать самому). null — выученных ловушек меньше `TRAPS_FLOOR`.
 */
export function trapsPlan(ids: readonly string[], cards: Record<string, SrsCard>, now: number): MistakesPlan | null {
  const known = ids.filter((id) => id in cards);
  if (known.length < TRAPS_FLOOR) return null;
  const words = known
    .map((id) => ({ id, r: retrievability(cards[id], now) }))
    .sort((a, b) => a.r - b.r || a.id.localeCompare(b.id))
    .slice(0, TRAPS_SIZE)
    .map((x) => x.id);
  const kinds: Record<string, StepKind> = Object.fromEntries(words.map((id, i) => [id, i % 2 ? 'type' : 'choice-es-ru']));
  return { words, rules: [], phrases: [], kinds };
}
