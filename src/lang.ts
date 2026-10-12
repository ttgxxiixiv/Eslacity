/**
 * Изучаемый язык. Выбор хранится в localStorage, смена языка перезагружает приложение:
 * у каждого языка своя база (слова, город, монеты, стрик) и свой контент.
 */
import { PROFILES } from './langs';
import type { Lang, LangProfile } from './langs/types';

export type { Lang, LangProfile } from './langs/types';

/** Свойства языка курса — его профиль (задача 16.6, `src/langs/<язык>/`). */
export type LangInfo = LangProfile;

export const LANGS: Record<Lang, LangInfo> = PROFILES;

/** Языки курса по порядку. */
export const LANG_IDS = Object.keys(LANGS) as Lang[];

/** Открытые курсы: их видно в выборе языка. Закрытый курс ещё пишется (`released` в профиле). */
export const RELEASED_LANGS = LANG_IDS.filter((l) => LANGS[l].released);

const isLang = (v: unknown): v is Lang => typeof v === 'string' && Object.hasOwn(LANGS, v);

export const LANG_KEY = 'eslacity.lang';

function readLang(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(LANG_KEY);
    return isLang(v) ? v : 'es';
  } catch {
    return 'es';
  }
}

/** Язык текущего запуска. Меняется только через перезагрузку. */
export const LANG: Lang = readLang();
export const L: LangInfo = LANGS[LANG];

export function switchLang(lang: Lang): void {
  if (lang === LANG) return;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    return;
  }
  location.hash = '#/';
  location.reload();
}
