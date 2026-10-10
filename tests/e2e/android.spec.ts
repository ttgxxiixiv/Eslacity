import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('в настройках есть приложение для Android: ссылка на APK рядом с игрой', async ({ page }) => {
      await openApp(page, lang);
      await page.goto('./#/settings/app');
      const link = page.getByTestId('apk-link');
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'eslacity.apk');
      await expect(page.getByTestId('android-app')).toContainText('Прогресс у приложения свой');
    });
  });
}
