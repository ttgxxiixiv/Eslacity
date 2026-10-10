import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

/** Загрузка и переходы (задача 14.6): ожидание вместо пустого экрана, предзагрузка урока, мягкое появление экранов. */

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('медленный контент: на экране свиток ожидания, потом урок', async ({ page }) => {
      await openApp(page, lang);
      // Слова аэропорта ещё не грузились (здание закрыто): задерживаем их чанк.
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route(/\/assets\/airport-[^/]+\.js$/, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto('./#/learn/airport/1/0');
      const loading = page.getByTestId('loading');
      await expect(loading).toBeVisible();
      await expect(loading).toHaveAttribute('role', 'status');
      await expect(loading).toContainText('Летописец');
      release();
      await expect(loading).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Выйти из урока' })).toBeVisible();
    });

    test('главная заранее грузит следующий урок грамматики', async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (r) => asked.push(r.url()));
      await openApp(page, lang);
      await expect.poll(() => asked.some((u) => u.includes(`grammar-${lang}-a1`)), { timeout: 5000 }).toBe(true);
    });

    test('экран проявляется, при «меньше движения» — сразу', async ({ page }) => {
      await openApp(page, lang, '/profile');
      const anim = () => page.locator('.screen-in').first().evaluate((el) => getComputedStyle(el).animationName);
      expect(await anim()).toBe('screen-in');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await anim()).toBe('none');
    });
  });
}
