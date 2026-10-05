import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

/** Медали в записи мотивации: золото «Словесника», серебро «Знатока правил». */
async function seedMedals(page: Page, lang: Lang) {
  await page.evaluate(
    (db) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          const store = tx.objectStore('meta');
          const get = store.get('motivation');
          get.onsuccess = () => {
            const value = get.result?.value ?? {};
            const t = Date.now();
            value.medals = {
              lines: { words: { wood: t, stone: t, bronze: t, silver: t, gold: t }, grammar: { wood: t, stone: t, bronze: t, silver: t } },
              secrets: value.medals?.secrets ?? {},
            };
            store.put({ key: 'motivation', value });
          };
          tx.oncomplete = () => resolve();
        };
      }),
    DB[lang],
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('золотая медаль ставит украшение на карту города, его можно убрать в профиле; фонарь путника за медали', async ({ page }) => {
      await openApp(page, lang);
      await expect(page.getByTestId('city-decor')).toHaveCount(0);
      await seedMedals(page, lang);
      // Золото «Словесника» — его знамя на перекрёстке.
      await expect(page.getByTestId('city-decor')).toHaveCount(1);
      await expect(page.getByTestId('city-decor')).toHaveAttribute('data-line', 'words');

      await page.goto('./#/profile');
      await expect(page.getByTestId('city-decor-card')).toContainText('1/12');
      await expect(page.getByTestId('decor-words')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('decor-grammar')).toBeDisabled();
      await page.getByTestId('decor-words').click();
      await expect(page.getByTestId('decor-words')).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(async () => (await readMeta<{ hiddenDecor?: string[] }>(page, lang, 'rewards'))?.hiddenDecor).toEqual(['words']);

      // Фонари: золото — лучшая медаль, бриллиантовый ещё закрыт.
      await expect(page.getByTestId('lantern-gold')).toBeEnabled();
      await expect(page.getByTestId('lantern-diamond')).toBeDisabled();
      await page.getByTestId('lantern-silver').click();
      await expect(page.getByTestId('lantern-silver')).toHaveAttribute('aria-checked', 'true');

      await page.goto('./#/');
      await expect(page.getByTestId('city-decor')).toHaveCount(0);
      await expect(page.getByTestId('hero').locator('svg')).toHaveAttribute('data-flame', '#e6f0ff');
      await page.reload();
      await expect(page.getByTestId('hero').locator('svg')).toHaveAttribute('data-flame', '#e6f0ff');
    });
  });
}
