/**
 * Изучаемый язык. Выбор хранится в localStorage, смена языка перезагружает приложение:
 * у каждого языка своя база (слова, город, монеты, стрик) и свой контент.
 */
export type Lang = 'es' | 'it';

export interface LangInfo {
  id: Lang;
  /** «Испанский» */
  name: string;
  flag: string;
  /** «по-испански» */
  adverb: string;
  /** Язык в родительном падеже для подсказок: «испанского». */
  genitive: string;
  /** Предпочтительные голоса синтеза речи, по порядку. */
  voices: string[];
  /** Любой голос с таким префиксом подойдёт, если предпочтительных нет. */
  voicePrefix: string;
  /** Локаль для сортировки. */
  locale: string;
  /** Имя базы IndexedDB. У испанского — прежнее, чтобы не потерять прогресс. */
  db: string;
  /** Определённые артикли: единственное и множественное число. */
  singular: string[];
  plural: string[];
  /** Неопределённые артикли. */
  indefinite: string[];
  /** Как установить голос на Android. */
  voiceHint: string;
}

export const LANGS: Record<Lang, LangInfo> = {
  es: {
    id: 'es',
    name: 'Испанский',
    flag: '🇪🇸',
    adverb: 'по-испански',
    genitive: 'испанского',
    voices: ['es-ES'],
    voicePrefix: 'es',
    locale: 'es',
    db: 'eslacity',
    singular: ['el', 'la'],
    plural: ['los', 'las'],
    indefinite: ['un', 'una', 'unos', 'unas'],
    voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Испанский (Испания)».',
  },
  it: {
    id: 'it',
    name: 'Итальянский',
    flag: '🇮🇹',
    adverb: 'по-итальянски',
    genitive: 'итальянского',
    voices: ['it-IT'],
    voicePrefix: 'it',
    locale: 'it',
    db: 'eslacity-it',
    singular: ['il', 'lo', 'la', "l'"],
    plural: ['i', 'gli', 'le'],
    indefinite: ['un', 'uno', 'una', "un'"],
    voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Итальянский (Италия)».',
  },
};

export const LANG_KEY = 'eslacity.lang';

function readLang(): Lang {
  try {
    const v = globalThis.localStorage?.getItem(LANG_KEY);
    return v === 'it' || v === 'es' ? v : 'es';
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
