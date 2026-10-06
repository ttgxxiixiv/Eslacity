import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/** `public/reminder-sw.js` в песочнице: кэш в памяти, уведомления копятся в массив. */
function loadSw() {
  const store = new Map<string, string>();
  const shown: { title: string; body: string }[] = [];
  const listeners: Record<string, (e: unknown) => void> = {};
  const cache = {
    keys: async () => [...store.keys()].map((url) => ({ url })),
    match: async (req: { url: string } | string) => {
      const v = store.get(typeof req === 'string' ? req : req.url);
      return v ? { json: async () => JSON.parse(v) } : undefined;
    },
    put: async (req: { url: string } | string, res: Response) => void store.set(typeof req === 'string' ? req : req.url, await res.text()),
  };
  const self = {
    addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] = f),
    registration: { scope: '/', showNotification: async (title: string, o: { body: string }) => void shown.push({ title, body: o.body }) },
    clients: {},
    checkReminders: undefined as unknown as (now: number) => Promise<void>,
  };
  runInNewContext(readFileSync('public/reminder-sw.js', 'utf8'), { self, caches: { open: async () => cache }, Response });
  return { store, shown, listeners, check: self.checkReminders };
}

const H = 3600_000;

describe('напоминания в service worker', () => {
  it('наступивший момент показывается один раз, будущий и опоздавший — нет', async () => {
    const { store, shown, listeners, check } = loadSw();
    expect(listeners.periodicsync).toBeTypeOf('function');
    const now = 100 * 24 * H;
    store.set('https://x/__reminder/es', JSON.stringify({ slots: [now - H, now + 23 * H], title: 'Летописец', body: 'Огонёк', shown: 0 }));
    await check(now);
    expect(shown).toEqual([{ title: 'Летописец', body: 'Огонёк' }]);
    await check(now + H);
    expect(shown).toHaveLength(1);
    // Следующий день: телефон спал, проверка пришла через 13 часов после момента — день прошёл, не показываем.
    await check(now + 36 * H);
    expect(shown).toHaveLength(1);
    expect(JSON.parse(store.get('https://x/__reminder/es')!).shown).toBe(now + 36 * H);
  });

  it('у каждого языка своя запись', async () => {
    const { store, shown, check } = loadSw();
    const now = 50 * 24 * H;
    store.set('es', JSON.stringify({ slots: [now - 1], title: 'es', body: '', shown: 0 }));
    store.set('it', JSON.stringify({ slots: [now - 1], title: 'it', body: '', shown: 0 }));
    await check(now);
    expect(shown.map((s) => s.title).sort()).toEqual(['es', 'it']);
  });
});
