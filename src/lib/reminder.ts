import { LocalNotifications } from '@capacitor/local-notifications';
import { CHRONICLER } from '../content/npcs';
import { REMINDER_DAYS, reminderSlots, reminderText } from '../domain/reminder';
import { isAlive } from '../domain/streak';
import { dayNumber, dueCards } from '../domain/srs';
import { LANG } from '../lang';
import { NATIVE } from './native';
import { useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

/**
 * Напоминания (задача 10.4). Где они работают:
 * - приложение для Android — плагин `@capacitor/local-notifications` ставит уведомления на ближайшие дни;
 * - сайт, установленный из Chrome на Android, — Periodic Background Sync: service worker (`public/reminder-sw.js`)
 *   просыпается, когда решит Chrome, и показывает уведомление, если время из расписания наступило;
 * - остальные браузеры фоновой проверки не умеют, настройки честно говорят об этом.
 * Расписание (`reminderSlots`) пересчитывается при запуске, при выполненной цели дня и при смене настроек.
 */

export type ReminderSupport = 'native' | 'periodic' | 'none';
/** on — работает; not-installed — сайт не установлен, фоновой проверки нет; denied — уведомления запрещены. */
export type ReminderStatus = 'on' | 'off' | 'not-installed' | 'denied' | 'unsupported';

const CACHE = 'eslacity-reminder';
const TAG = 'eslacity-reminder';
/** У каждого языка свои номера уведомлений в приложении: оба курса могут напоминать независимо. */
const NATIVE_BASE = LANG === 'es' ? 1000 : 2000;

interface PeriodicSync {
  register(tag: string, opts: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
const periodicOf = (reg: ServiceWorkerRegistration) => (reg as unknown as { periodicSync?: PeriodicSync }).periodicSync;

export function reminderSupport(): ReminderSupport {
  if (NATIVE) return 'native';
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('caches' in window)) return 'none';
  return 'periodicSync' in ServiceWorkerRegistration.prototype ? 'periodic' : 'none';
}

/** Регистрация service worker, но не дольше пары секунд: в разработке его нет. */
async function swReady(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 2000))]);
}

/** Включить: спросить разрешение на уведомления и фоновую проверку. Возвращает, что вышло. */
export async function enableReminder(): Promise<ReminderStatus> {
  const support = reminderSupport();
  if (support === 'native') {
    const p = await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' }));
    return p.display === 'granted' ? 'on' : 'denied';
  }
  if (support === 'none') return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await swReady();
  const ps = reg && periodicOf(reg);
  if (!ps) return 'not-installed';
  try {
    await ps.register(TAG, { minInterval: 3600_000 });
    return 'on';
  } catch {
    // Chrome даёт фоновую проверку только установленному приложению.
    return 'not-installed';
  }
}

/** Состояние без вопросов к игроку: для подписи в настройках. */
export async function reminderStatus(): Promise<ReminderStatus> {
  if (!useSettings.getState().reminderOn) return 'off';
  const support = reminderSupport();
  if (support === 'native') {
    const p = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }));
    return p.display === 'granted' ? 'on' : 'denied';
  }
  if (support === 'none') return 'unsupported';
  if (Notification.permission !== 'granted') return 'denied';
  const reg = await swReady();
  const tags = await (reg && periodicOf(reg)?.getTags())?.catch(() => [] as string[]);
  return tags?.includes(TAG) ? 'on' : 'not-installed';
}

const cacheKey = () => new URL(`./__reminder/${LANG}`, document.baseURI).href;

/** Пересчитать и записать расписание (или убрать, если напоминание выключено). */
export async function syncReminder(now = Date.now()): Promise<number[]> {
  const support = reminderSupport();
  if (support === 'none') return [];
  const { reminderOn, reminderTime } = useSettings.getState();
  const p = useProgress.getState();
  const m = useMotivation.getState();
  const slots = reminderOn ? reminderSlots(now, reminderTime, !!p.day.goalMet) : [];
  const streak = isAlive(m.streak, dayNumber(now)) ? m.streak.count : 0;
  const { title, body } = reminderText(CHRONICLER.name, streak, dueCards(Object.values(p.cards), now).length);
  try {
    if (support === 'native') {
      await LocalNotifications.cancel({ notifications: Array.from({ length: REMINDER_DAYS }, (_, i) => ({ id: NATIVE_BASE + i })) });
      if (slots.length) {
        await LocalNotifications.schedule({
          notifications: slots.map((t, i) => ({ id: NATIVE_BASE + i, title, body, schedule: { at: new Date(t), allowWhileIdle: true } })),
        });
      }
    } else {
      const cache = await caches.open(CACHE);
      const key = cacheKey();
      if (!slots.length) await cache.delete(key);
      else {
        // Отметку «уже показано» сохраняем: иначе пересчёт мог бы показать то же напоминание ещё раз.
        const prev = (await cache.match(key).then((r) => r?.json()).catch(() => null)) as { shown?: number } | null;
        const icon = new URL('./icons/icon-192.png', document.baseURI).href;
        const value = { slots, title, body, icon, url: new URL('./', document.baseURI).href, shown: prev?.shown ?? 0 };
        await cache.put(key, new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }));
      }
    }
  } catch (e) {
    console.error('Не удалось обновить напоминание', e);
  }
  return slots;
}

/**
 * Следить за тем, от чего зависит расписание: цель дня выполнена, напоминание включено или время другое.
 * Вызывается один раз при запуске.
 */
export function watchReminder(): void {
  let key = '';
  const check = () => {
    const s = useSettings.getState();
    const next = `${s.reminderOn}|${s.reminderTime}|${useProgress.getState().day.date}|${!!useProgress.getState().day.goalMet}`;
    if (next === key) return;
    key = next;
    void syncReminder();
  };
  useSettings.subscribe(check);
  useProgress.subscribe(check);
  check();
}
