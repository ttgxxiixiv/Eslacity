import { expect, test } from '@playwright/test';
import { LANGS, openApp, seedDueCards, wordIdsOf } from './fixtures';

/**
 * Главная (задача 14.1): над картой только верхняя панель, «Продолжить» и ряд круглых кнопок.
 * Карта города начинается на первом экране телефона 393×852 без прокрутки.
 */
for (const lang of LANGS) {
  test.describe(lang, () => {
    test('карта города видна на первом экране, остальное — круглые кнопки с бейджами', async ({ page }) => {
      await openApp(page, lang);
      // Слов хватает на все кнопки: повтор, путь, правила, блиц.
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      const dock = page.getByTestId('home-dock');
      for (const id of ['review-card', 'journey-line', 'grammar-next']) await expect(dock.getByTestId(id)).toBeVisible();
      await expect(dock.getByRole('link', { name: /Блиц/ })).toBeVisible();
      // Бейдж повтора — число карточек к повторению, полный текст блока — для диктора.
      await expect(dock.getByTestId('review-card')).toContainText(/на сегодня/);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const viewport = page.viewportSize()!;
      const map = (await page.getByTestId('city-map').boundingBox())!;
      // Верх карты с заголовком и первым рядом зданий — в пределах экрана.
      expect(map.y + 160).toBeLessThan(viewport.height);
    });
  });
}
