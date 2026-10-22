import { create } from 'zustand';
import {
  COURSE_LANG_KEY, COURSE_META_CACHE, courseCacheName, courseListPath, courseStamp, missingFiles, staleFiles, type CourseList,
} from '../domain/course';
import { LANG, switchLang, type Lang } from '../lang';
import { NATIVE } from './native';

/**
 * Кэш курса на странице (задача 20.4). Оболочка приложения лежит в precache service worker, а файлы языка курса
 * (`assets/<язык>/`) страница докачивает сама по списку своей версии: после первого запуска курс работает без
 * сети. Приложение для Android несёт всё в себе, в режиме разработки файлов курса нет — там кэш не нужен.
 */

/** `local` — кэш не нужен (APK, разработка, браузер без Cache API). */
export type CourseState = 'checking' | 'downloading' | 'ready' | 'offline' | 'local';

interface CourseStore {
  state: CourseState;
  done: number;
  total: number;
  /** Сообщение после попытки открыть нескачанный курс без сети. */
  notice: string | null;
}

export const useCourse = create<CourseStore>(() => ({ state: 'checking', done: 0, total: 0, notice: null }));

/** Сообщение, когда курс без сети не скачать. */
export const COURSE_OFFLINE_TEXT = 'Курс скачается, когда появится интернет.';

const STAMP = courseStamp(__APP_BUILD__.builtAt);
const markKey = (lang: Lang) => `eslacity.course.${lang}`;
const url = (path: string) => new URL(path, document.baseURI).href;

function cacheNeeded(): boolean {
  return !NATIVE && !import.meta.env.DEV && typeof caches !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** Курс этой версии скачан целиком: на него можно переключиться и без сети. */
export function courseReady(lang: Lang): boolean {
  if (!cacheNeeded()) return true;
  try {
    return localStorage.getItem(markKey(lang)) === STAMP;
  } catch {
    return false;
  }
}

/** Список файлов курса своей версии: из сети, без сети — сохранённый раньше. */
async function courseList(lang: Lang): Promise<CourseList | null> {
  const meta = await caches.open(COURSE_META_CACHE);
  const listUrl = url(courseListPath(lang, STAMP));
  try {
    const res = await fetch(listUrl, { cache: 'no-store' });
    if (res.ok) {
      await meta.put(listUrl, res.clone());
      return (await res.json()) as CourseList;
    }
  } catch {
    // Нет сети: ниже — сохранённый список.
  }
  const saved = await meta.match(listUrl);
  return saved ? ((await saved.json()) as CourseList) : null;
}

async function download(): Promise<void> {
  if (!cacheNeeded()) {
    useCourse.setState({ state: 'local' });
    return;
  }
  const meta = await caches.open(COURSE_META_CACHE);
  // Service worker новой версии докачает этот курс при установке.
  await meta.put(url(COURSE_LANG_KEY), new Response(LANG));
  const list = await courseList(LANG);
  if (!list) {
    useCourse.setState({ state: 'offline' });
    return;
  }
  const cache = await caches.open(courseCacheName(LANG));
  const wanted = list.files.map(url);
  const have = (await cache.keys()).map((r) => r.url);
  const queue = missingFiles(wanted, have);
  useCourse.setState({ total: wanted.length, done: wanted.length - queue.length });
  if (queue.length) {
    if (!navigator.onLine) {
      useCourse.setState({ state: 'offline' });
      return;
    }
    useCourse.setState({ state: 'downloading' });
    let failed = false;
    const worker = async () => {
      for (let u = queue.shift(); u; u = queue.shift()) {
        try {
          await cache.add(u);
          useCourse.setState((s) => ({ done: s.done + 1 }));
        } catch {
          failed = true;
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    if (failed) {
      useCourse.setState({ state: 'offline' });
      return;
    }
  }
  // Файлы прежних версий курса больше не нужны.
  for (const u of staleFiles(wanted, (await cache.keys()).map((r) => r.url))) await cache.delete(u);
  try {
    localStorage.setItem(markKey(LANG), STAMP);
  } catch {
    // Без localStorage курс всё равно в кэше, только переключиться на него без сети будет нельзя.
  }
  useCourse.setState({ state: 'ready' });
}

let running: Promise<void> | null = null;

/** Проверить и докачать курс. Повторный вызов во время докачки ждёт ту же. */
export function syncCourse(): Promise<void> {
  running ??= download()
    .catch(() => {
      useCourse.setState({ state: 'offline' });
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Докачка при запуске и при появлении сети. */
export function initCourse() {
  if (!cacheNeeded()) {
    useCourse.setState({ state: 'local' });
    return;
  }
  // Сначала запуск: файлы курса нужны и самому приложению, докачка остального — следом.
  setTimeout(() => void syncCourse(), 1500);
  window.addEventListener('online', () => {
    if (useCourse.getState().state !== 'ready') void syncCourse();
  });
}

/** Сменить язык курса. Без сети на нескачанный курс не переключаемся: он бы не открылся. */
export function openCourseLang(lang: Lang): boolean {
  if (lang !== LANG && !navigator.onLine && !courseReady(lang)) {
    useCourse.setState({ notice: COURSE_OFFLINE_TEXT });
    return false;
  }
  useCourse.setState({ notice: null });
  switchLang(lang);
  return true;
}
