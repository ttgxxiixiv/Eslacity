import { expect, test } from '@playwright/test';
import { LANGS, openApp, playWords, readMeta } from './fixtures';

const rootSize = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('размер текста: очень крупный сохраняется, урок слов проходится целиком без горизонтальной прокрутки', async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, lang);
      expect(await rootSize(page)).toBe('16px');
      await page.goto('./#/settings/app');
      const card = page.getByTestId('text-size');
      await card.getByRole('button', { name: 'Очень крупный' }).click();
      await expect(card.getByRole('button', { name: 'Очень крупный' })).toHaveAttribute('aria-pressed', 'true');
      expect(await rootSize(page)).toBe('20px');
      await expect.poll(async () => (await readMeta<{ textSize: string }>(page, lang, 'settings'))?.textSize).toBe('xlarge');

      // После перезапуска размер тот же, урок проходится, экран не шире телефона.
      await page.goto('./#/learn/cafe/1/0');
      await page.reload();
      expect(await rootSize(page)).toBe('20px');
      const { verdicts } = await playWords(page, lang, /урок пройден/i);
      expect(verdicts.correct).toBeGreaterThan(10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto('./#/settings/app');
      await page.getByTestId('text-size').getByRole('button', { name: 'Обычный' }).click();
      expect(await rootSize(page)).toBe('16px');
    });
  });
}
