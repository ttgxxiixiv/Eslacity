import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';

export const CURRENT: BuildInfo = __APP_BUILD__;

type Status = 'idle' | 'checking' | 'latest' | 'available' | 'offline' | 'error' | 'failed' | 'updating';

interface UpdateState {
  status: Status;
  /** Версия, опубликованная на сайте (из version.json). */
  remote: BuildInfo | null;
  checkedAt: number | null;
  /** Проверить сайт на новую версию. */
  check(): Promise<void>;
  /** Установить новую версию и перезапустить приложение. */
  apply(): Promise<void>;
}

let registration: ServiceWorkerRegistration | undefined;
let updateSW: (reload?: boolean) => Promise<void> = async () => location.reload();

export function isNewer(remote: BuildInfo, current: BuildInfo): boolean {
  return remote.builtAt > current.builtAt;
}

export const useUpdate = create<UpdateState>((set, get) => ({
  status: 'idle',
  remote: null,
  checkedAt: null,

  async check() {
    if (get().status === 'checking' || get().status === 'updating') return;
    set({ status: 'checking' });
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const remote = (await res.json()) as BuildInfo;
      // Заодно просим service worker скачать новую версию, чтобы кнопка «Обновить» сработала сразу.
      registration?.update().catch(() => {});
      set({ remote, checkedAt: Date.now(), status: isNewer(remote, CURRENT) ? 'available' : 'latest' });
    } catch {
      set({ status: navigator.onLine ? 'error' : 'offline', checkedAt: Date.now() });
    }
  },

  async apply() {
    set({ status: 'updating' });
    const reg = registration;
    // Страница не под управлением service worker (первый запуск): обычная перезагрузка
    // и так загрузит новую версию из сети.
    if (!reg || !navigator.serviceWorker.controller) {
      location.reload();
      return;
    }
    const activeBefore = reg.active;
    if (!reg.waiting) {
      // Новая версия ещё не скачана: запрашиваем и ждём до минуты (около 1 МБ на медленной сети).
      await reg.update().catch(() => {});
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 60_000);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        const watch = (sw: ServiceWorker | null) =>
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' || sw.state === 'activated') done();
          });
        if (reg.waiting || reg.active !== activeBefore) done();
        else if (reg.installing) watch(reg.installing);
        else reg.addEventListener('updatefound', () => watch(reg.installing), { once: true });
      });
    }
    if (reg.waiting) await updateSW(true);
    // Новая версия уже активировалась сама: достаточно перезагрузки.
    else if (reg.active !== activeBefore) location.reload();
    // Перезагрузка без скачанной версии открыла бы ту же старую: сообщаем и даём повторить.
    else set({ status: 'failed' });
  },
}));

/** Регистрация service worker. Вызывается один раз при старте. */
export function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    onNeedRefresh() {
      useUpdate.setState({ status: 'available' });
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      // Проверяем раз в час и при возврате в приложение.
      setInterval(() => reg?.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
  // Тихая проверка вскоре после запуска: если есть новая версия, появится плашка.
  setTimeout(() => useUpdate.getState().check(), 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration?.update().catch(() => {});
  });
}
