import INDEX, { MISSIONS, PHRASES, SCROLLS } from 'virtual:word-index';
import { LANG } from '../lang';

/** Место → уровень → id слов выбранного языка. Сами слова грузятся по местам (`loadLocation`). */
export const WORD_LEVELS: Record<string, Record<number, string[]>> = Object.fromEntries(
  Object.entries(INDEX[LANG] ?? {}).map(([loc, levels]) => [
    loc,
    Object.fromEntries(Object.entries(levels).map(([lvl, slugs]) => [lvl, slugs.map((s) => `${loc}.${s}`)])),
  ]),
);

/** id фраз выбранного языка: в словарный запас они не входят. */
export const PHRASE_IDS: ReadonlySet<string> = new Set(PHRASES[LANG] ?? []);

/** Глава → id слов свитка земли выбранного языка. Свитка главы может ещё не быть. */
export const SCROLL_WORDS: Record<number, string[]> = SCROLLS[LANG] ?? {};

/** Место → главы с сюжетной миссией выбранного языка. */
export const MISSION_CHAPTERS: Record<string, number[]> = MISSIONS[LANG] ?? {};
