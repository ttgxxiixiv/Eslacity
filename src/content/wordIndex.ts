import INDEX from 'virtual:word-index';
import { LANG } from '../lang';

/** Место → уровень → id слов выбранного языка. Сами слова грузятся по местам (`loadLocation`). */
export const WORD_LEVELS: Record<string, Record<number, string[]>> = Object.fromEntries(
  Object.entries(INDEX[LANG] ?? {}).map(([loc, levels]) => [
    loc,
    Object.fromEntries(Object.entries(levels).map(([lvl, slugs]) => [lvl, slugs.map((s) => `${loc}.${s}`)])),
  ]),
);
