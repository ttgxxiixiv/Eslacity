import { expect, test } from '@playwright/test';
import { openApp } from './fixtures';

// Рисованные портреты есть только у испанских персонажей; у итальянских остаются пиксельные.
test.describe('es', () => {
  test('рисованные портреты: квест на главной, житель места, страж, кузнец; на картах — пиксельные фигурки', async ({ page }) => {
    await openApp(page, 'es');
    await expect(page.getByTestId('continue').locator('img[data-testid="npc-art"]')).toHaveAttribute('src', /lola.*\.webp/);
    // На карте города житель стоит у здания пиксельной фигуркой.
    await expect(page.getByTestId('npc-cafe').locator('svg')).toBeVisible();

    await page.goto('./#/loc/cafe');
    const lola = page.getByRole('img', { name: /^Лола/ });
    await expect(lola).toHaveAttribute('src', /lola.*\.webp/);
    // Картинка загрузилась, а не битая ссылка.
    await expect.poll(() => lola.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

    await page.goto('./#/guardian/1');
    await expect(page.getByRole('img', { name: 'Привратник' }).first()).toHaveAttribute('src', /guardian1.*\.webp/);
    await page.goto('./#/journey-map');
    await expect(page.getByTestId('guardian-sprite').locator('svg')).toHaveCount(1);

    await page.goto('./#/forge');
    await expect(page.getByRole('img', { name: 'Херардо' })).toHaveAttribute('src', /smith.*\.webp/);
  });
});

test.describe('it', () => {
  test('у итальянских персонажей пиксельные портреты', async ({ page }) => {
    await openApp(page, 'it', '/loc/cafe');
    await expect(page.getByRole('img', { name: /^Джулия/ })).toBeVisible();
    await expect(page.locator('img[data-testid="npc-art"]')).toHaveCount(0);
  });
});
