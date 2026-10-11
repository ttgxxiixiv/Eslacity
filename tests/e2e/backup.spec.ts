import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, seedDueCards, wordIdsOf } from './fixtures';
import type { Lang } from '../../src/lang';

const DAY = 86_400_000;

/** Записать `meta.backup` и перезагрузить. */
async function seedBackup(page: Page, lang: Lang, value: Record<string, number>) {
  await page.evaluate(
    ({ db, value }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'backup', value });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], value },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(`копия прогресса: ${lang}`, () => {
    test('новый путник напоминания не видит, через неделю — кнопка «Копия», копия снимает её', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1]).slice(0, 3));
      await expect(page.getByTestId('home-dock')).toBeVisible();
      await expect(page.getByTestId('backup-button')).toHaveCount(0);
      // Отсчёт недели начался с первого запуска.
      expect((await readMeta<{ since?: number }>(page, lang, 'backup'))?.since).toBeGreaterThan(0);

      await seedBackup(page, lang, { since: Date.now() - 8 * DAY });
      await page.getByTestId('backup-button').click();
      await expect(page).toHaveURL(/#\/settings\/data$/);
      await expect(page.getByTestId('backup-due')).toContainText('Сохраните путь');
      await expect(page.getByTestId('backup-last')).toContainText('Копий ещё не было');

      const download = page.waitForEvent('download');
      await page.getByTestId('backup-save').click();
      expect((await download).suggestedFilename()).toMatch(new RegExp(`^eslacity-${lang}-\\d{4}-\\d{2}-\\d{2}\\.json$`));
      await expect(page.getByTestId('backup-due')).toHaveCount(0);
      await expect(page.getByTestId('backup-last')).toContainText('сегодня');

      await page.goto('./#/');
      await expect(page.getByTestId('home-dock')).toBeVisible();
      await expect(page.getByTestId('backup-button')).toHaveCount(0);
    });

    test('«Напомнить через неделю» откладывает, старая копия — снова напоминание', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1]).slice(0, 3));
      await seedBackup(page, lang, { since: Date.now() - 30 * DAY, saved: Date.now() - 9 * DAY });
      await expect(page.getByTestId('backup-button')).toBeVisible();
      await page.goto('./#/settings/data');
      await expect(page.getByTestId('backup-last')).toContainText('9 дней назад');
      await page.getByTestId('backup-snooze').click();
      await expect(page.getByTestId('backup-due')).toHaveCount(0);
      expect((await readMeta<{ snoozed?: number }>(page, lang, 'backup'))?.snoozed).toBeGreaterThan(Date.now() - DAY);
      await page.goto('./#/');
      await expect(page.getByTestId('home-dock')).toBeVisible();
      await expect(page.getByTestId('backup-button')).toHaveCount(0);
    });

    test('без постоянного хранилища в разделе предупреждение', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(false) });
      });
      await openApp(page, lang, '/settings/data');
      await expect(page.getByTestId('storage-warning')).toContainText('главный экран');
    });

    test('постоянное хранилище есть — предупреждения нет', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator.storage, 'persisted', { value: () => Promise.resolve(true) });
      });
      await openApp(page, lang, '/settings/data');
      await expect(page.getByTestId('backup-save')).toBeVisible();
      await expect(page.getByTestId('storage-warning')).toHaveCount(0);
    });
  });
}
