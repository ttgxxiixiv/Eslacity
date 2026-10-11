import { LANG, type Lang } from '../lang';

// Индекс только языка курса, своим чанком (задача 16.2): индексы всех языков вместе весили бы вдвое больше.
// Ожидание на верхнем уровне модуля: всё, что берёт индекс, получает его уже готовым.
const LOADERS: Record<Lang, () => Promise<typeof import('virtual:word-index/es')>> = {
  es: () => import('virtual:word-index/es'),
  it: () => import('virtual:word-index/it'),
};
const { default: INDEX, EXPRESSIONS, MISSIONS, PAIRS, PHRASES, SCROLLS } = await LOADERS[LANG]();

/** Место → уровень → id слов выбранного языка. Сами слова грузятся по местам (`loadLocation`). */
export const WORD_LEVELS: Record<string, Record<number, string[]>> = Object.fromEntries(
  Object.entries(INDEX).map(([loc, levels]) => [
    loc,
    Object.fromEntries(Object.entries(levels).map(([lvl, slugs]) => [lvl, slugs.map((s) => `${loc}.${s}`)])),
  ]),
);

/** id фраз выбранного языка: в словарный запас они не входят. */
export const PHRASE_IDS: ReadonlySet<string> = new Set(PHRASES);

/** Глава → id слов свитка земли выбранного языка. Свитка главы может ещё не быть. */
export const SCROLL_WORDS: Record<number, string[]> = SCROLLS;

/** Место → главы с сюжетной миссией выбранного языка. */
export const MISSION_CHAPTERS: Record<string, number[]> = MISSIONS;

/** Выражение → его пара в другом регистре (выбранный язык): из них собираются поручения «Эхо». */
export const EXPRESSION_PAIRS: Readonly<Record<string, string>> = PAIRS;

/** id выражений уровня 7 выбранного языка. */
export const EXPRESSION_IDS: ReadonlySet<string> = new Set(EXPRESSIONS);
