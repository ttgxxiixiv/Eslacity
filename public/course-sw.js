/*
 * Кэш курса в service worker (задача 20.4): кусок service worker, его подключает workbox (`importScripts` в
 * vite.config.ts). В precache только оболочка, контент языка лежит в кэше `eslacity-course-<язык>`. Когда
 * ставится новая версия, она докачивает файлы курса заранее, пока работает прежняя: после обновления курс
 * открывается и без сети. Язык курса оставляет страница (`src/lib/course.ts`) в кэше `eslacity-course-meta`.
 * Имена кэшей и списка — как в `src/domain/course.ts`. Ошибка сети установку не срывает: недостающее докачает страница.
 */
const COURSE_META = 'eslacity-course-meta';

async function prefetchCourse() {
  const meta = await caches.open(COURSE_META);
  const base = self.registration.scope;
  const saved = await meta.match(new URL('course-lang', base).href);
  if (!saved) return;
  const lang = (await saved.text()).trim();
  const version = await (await fetch(new URL('version.json', base).href, { cache: 'no-store' })).json();
  const stamp = String(version.builtAt).replace(/\D/g, '');
  const listUrl = new URL(`course/${lang}-${stamp}.json`, base).href;
  const res = await fetch(listUrl, { cache: 'no-store' });
  if (!res.ok) return;
  await meta.put(listUrl, res.clone());
  const list = await res.json();
  const cache = await caches.open(`eslacity-course-${lang}`);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const queue = list.files.map((f) => new URL(f, base).href).filter((u) => !have.has(u));
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) await cache.add(url).catch(() => {});
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(prefetchCourse().catch(() => {}));
});
