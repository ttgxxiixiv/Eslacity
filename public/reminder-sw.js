/*
 * Напоминания на сайте (задача 10.4): кусок service worker, его подключает workbox (`importScripts` в vite.config.ts).
 * Расписание кладёт страница (`src/lib/reminder.ts`) в кэш `eslacity-reminder`, по записи на язык курса:
 * { slots: [моменты, мс], title, body, icon, url, shown }. Браузер будит service worker событием `periodicsync`
 * (Chrome на Android, установленное приложение, интервал выбирает сам Chrome). Если момент из расписания
 * наступил и ещё не показан, приходит уведомление. Опоздавшее больше чем на 12 часов не показывается: день прошёл.
 */
const REMINDER_CACHE = 'eslacity-reminder';
const REMINDER_TAG = 'eslacity-reminder';
const REMINDER_LATE_MS = 12 * 3600 * 1000;

async function checkReminders(now) {
  const cache = await caches.open(REMINDER_CACHE);
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (!res) continue;
    const r = await res.json();
    const due = (r.slots || []).filter((t) => t <= now && t > (r.shown || 0));
    if (!due.length) continue;
    if (now - Math.max(...due) < REMINDER_LATE_MS) {
      await self.registration.showNotification(r.title, { body: r.body, icon: r.icon, tag: req.url, data: { url: r.url } });
    }
    r.shown = now;
    await cache.put(req, new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } }));
  }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === REMINDER_TAG) e.waitUntil(checkReminders(Date.now()));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow(url))),
  );
});

self.checkReminders = checkReminders;
