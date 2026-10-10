import { expect, test, type Page } from '@playwright/test';
import { LANGS, openApp, readMeta } from './fixtures';

/** Запись расписания для service worker: кэш `eslacity-reminder`, ключ — язык курса. */
const entry = (page: Page, lang: string) =>
  page.evaluate(async (l) => {
    const cache = await caches.open('eslacity-reminder');
    const keys = await cache.keys();
    const key = keys.find((k) => k.url.endsWith(`/__reminder/${l}`));
    return key ? ((await (await cache.match(key))!.json()) as { slots: number[]; title: string; body: string }) : null;
  }, lang);

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('напоминание: включить, время, расписание для service worker, без установки — честная подпись', async ({ page, context }) => {
      await context.grantPermissions(['notifications']);
      await openApp(page, lang, '/settings/reminder');
      // Обработчик напоминаний подключён к service worker сборки.
      expect(await page.evaluate(() => fetch('./sw.js').then((r) => r.text()))).toContain('reminder-sw.js');
      const card = page.getByTestId('reminder');
      await expect(page.getByTestId('reminder-time')).toBeDisabled();
      await page.getByTestId('reminder-toggle').click();
      await expect(page.getByTestId('reminder-toggle')).toHaveAttribute('aria-checked', 'true');
      // Chrome даёт фоновую проверку только установленному приложению: в тесте сайт не установлен.
      await expect(card.getByTestId('reminder-note')).toContainText('Установите Eslacity на главный экран');
      await expect.poll(async () => (await readMeta<{ reminderOn?: boolean }>(page, lang, 'settings'))?.reminderOn).toBe(true);

      await expect.poll(async () => (await entry(page, lang))?.slots.length).toBe(7);
      const e = (await entry(page, lang))!;
      expect(e.title).toContain('дневной переход');
      expect(e.body).toMatch(/Путь к Хранилищу ждёт|Огонёк горит/);
      const first = new Date(e.slots[0]);
      expect(first.getHours() * 60 + first.getMinutes()).toBe(19 * 60);

      await page.getByTestId('reminder-time').fill('07:45');
      await expect.poll(async () => {
        const d = new Date((await entry(page, lang))!.slots[0]);
        return `${d.getHours()}:${d.getMinutes()}`;
      }).toBe('7:45');
      await expect.poll(async () => (await readMeta<{ reminderTime?: string }>(page, lang, 'settings'))?.reminderTime).toBe('07:45');

      // После перезапуска напоминание включено, расписание на месте.
      await page.reload();
      await expect(page.getByTestId('reminder-toggle')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('reminder-time')).toHaveValue('07:45');

      await page.getByTestId('reminder-toggle').click();
      await expect.poll(() => entry(page, lang)).toBeNull();
    });

    test('уведомления запрещены — подсказка, где разрешить', async ({ page, context }) => {
      await context.clearPermissions();
      await page.addInitScript(() => {
        Notification.requestPermission = () => Promise.resolve('denied');
      });
      await openApp(page, lang, '/settings/reminder');
      await page.getByTestId('reminder-toggle').click();
      await expect(page.getByTestId('reminder').getByTestId('reminder-note')).toContainText('Уведомления запрещены');
    });
  });
}
