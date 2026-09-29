import { expect, test } from '@playwright/test';
import { openApp } from './fixtures';

// Рисованные портреты есть у персонажей обоих языков; на картах города и странствий — пиксельные фигурки.
const CASES = [
  { lang: 'es', resident: 'Лола', art: 'lola', smith: 'Херардо' },
  { lang: 'it', resident: 'Джулия', art: 'giulia', smith: 'Ферруччо' },
] as const;

for (const c of CASES) {
  test.describe(c.lang, () => {
    test('рисованные портреты: квест на главной, житель места, страж, кузнец; на картах — пиксельные фигурки', async ({ page }) => {
      await openApp(page, c.lang);
      await expect(page.getByTestId('continue').locator('img[data-testid="npc-art"]')).toHaveAttribute('src', new RegExp(`${c.art}.*\\.webp`));
      // На карте города житель стоит у здания пиксельной фигуркой.
      await expect(page.getByTestId('npc-cafe').locator('svg')).toBeVisible();

      await page.goto('./#/loc/cafe');
      const resident = page.getByRole('img', { name: new RegExp(`^${c.resident}`) });
      await expect(resident).toHaveAttribute('src', new RegExp(`${c.art}.*\\.webp`));
      // Картинка загрузилась, а не битая ссылка.
      await expect.poll(() => resident.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

      await page.goto('./#/guardian/1');
      await expect(page.getByRole('img', { name: 'Привратник' }).first()).toHaveAttribute('src', /guardian1.*\.webp/);
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('guardian-sprite').locator('svg')).toHaveCount(1);

      await page.goto('./#/forge');
      await expect(page.getByRole('img', { name: c.smith })).toHaveAttribute('src', /smith.*\.webp/);
    });
  });
}
