import { expect, test } from '@playwright/test';
import { LANGS, loadWords, openApp, playWords, seedDueCards } from './fixtures';

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('повторение: карточки к повтору проходятся и уходят', async ({ page }) => {
      await openApp(page, lang);
      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 10).map((w) => w.id);
      await seedDueCards(page, lang, ids);
      await page.goto('./#/review');
      await playWords(page, lang, /повторение завершено/i);
      await page.goto('./#/');
      await expect(page.getByText('На сегодня всё повторено')).toBeVisible();
    });

    test('блиц: игра и итог', async ({ page }) => {
      await openApp(page, lang);
      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 10).map((w) => w.id);
      await seedDueCards(page, lang, ids);
      await page.goto('./#/blitz');
      await page.getByRole('button', { name: 'Старт' }).click();
      for (let i = 0; i < 5; i++) {
        await page.locator('button.min-h-14').first().click();
        await page.waitForTimeout(700);
      }
      await page.getByRole('button', { name: 'Закончить' }).click();
      await expect(page.getByText('Ещё раз')).toBeVisible();
    });
  });
}
