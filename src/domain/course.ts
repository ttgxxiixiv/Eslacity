/**
 * Кэш курса (задача 20.4). В precache service worker лежит только оболочка приложения: код, общие картинки, шрифты.
 * Контент языка — чанки и портреты в `assets/<язык>/` — качается в свой кэш `eslacity-course-<язык>` по списку
 * файлов версии `course/<язык>-<метка>.json`, который сборка кладёт рядом с приложением (`vite.config.ts`).
 * Здесь общее для сборки, страницы (`src/lib/course.ts`) и service worker (`public/course-sw.js` повторяет имена).
 */

/** Кэш, где страница оставляет язык курса и списки файлов: service worker берёт из него, какой курс докачать. */
export const COURSE_META_CACHE = 'eslacity-course-meta';
/** Ключ записи с языком курса в `COURSE_META_CACHE`. */
export const COURSE_LANG_KEY = 'course-lang';

/** Кэш файлов курса одного языка. */
export const courseCacheName = (lang: string) => `eslacity-course-${lang}`;

/** Метка сборки для имени списка файлов: время сборки без разделителей. */
export const courseStamp = (builtAt: string) => builtAt.replace(/\D/g, '');

/** Путь списка файлов курса относительно корня приложения. */
export const courseListPath = (lang: string, stamp: string) => `course/${lang}-${stamp}.json`;

/** Список файлов курса: что лежит в `course/<язык>-<метка>.json`. */
export interface CourseList {
  lang: string;
  stamp: string;
  /** Пути относительно корня приложения: `assets/es/cafe-….js`. */
  files: string[];
  /** Сумма размеров, байт. */
  bytes: number;
}

/** Чего из списка ещё нет в кэше. Адреса — полные, как ключи кэша. */
export function missingFiles(wanted: readonly string[], have: Iterable<string>): string[] {
  const got = new Set(have);
  return wanted.filter((u) => !got.has(u));
}

/** Что в кэше лишнее: файлы прежних версий курса. */
export function staleFiles(wanted: readonly string[], have: Iterable<string>): string[] {
  const keep = new Set(wanted);
  return [...have].filter((u) => !keep.has(u));
}
