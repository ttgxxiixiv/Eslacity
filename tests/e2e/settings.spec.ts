import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

/** Настройки по разделам (задача 14.4): оглавление и свой экран у каждого раздела. */
const SECTIONS: [string, string, string][] = [
  ['hero', 'Путник', 'hero-gender'],
  ['learning', 'Обучение', 'new-per-day'],
  ['sound', 'Звук и озвучка', 'sound-card'],
  ['reminder', 'Напоминание', 'reminder'],
  ['language', 'Язык курса', ''],
  ['data', 'Данные и копии', ''],
  ['app', 'Приложение', 'text-size'],
  ['reports', 'Отчёты', 'reports-count'],
];

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('настройки: оглавление из восьми разделов, у каждого свой экран', async ({ page }) => {
      await openApp(page, lang, '/profile');
      await page.getByRole('link', { name: 'Настройки' }).first().click();
      await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
      for (const [id] of SECTIONS) await expect(page.getByTestId(`settings-${id}`)).toBeVisible();
      await expect(page.getByTestId('settings-reminder')).toContainText('Выключено');
      await expect(page.getByTestId('settings-language')).toContainText(lang === 'es' ? 'Испанский' : 'Итальянский');
      // На экране оглавления нет самих настроек.
      await expect(page.getByTestId('text-size')).toHaveCount(0);

      for (const [id, title, inside] of SECTIONS) {
        await page.getByTestId(`settings-${id}`).click();
        await expect(page.getByTestId('settings-section')).toHaveAttribute('data-section', id);
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        if (inside) await expect(page.getByTestId(inside)).toBeVisible();
        await page.getByRole('button', { name: 'Назад' }).click();
        await expect(page.getByTestId('settings-hero')).toBeVisible();
      }

      // Подпись раздела показывает выбранное.
      await page.getByTestId('settings-hero').click();
      await page.getByTestId('hero-gender-f').click();
      await page.getByTestId('hero-name').fill('Lucia');
      await page.getByTestId('hero-name').press('Enter');
      await page.getByRole('button', { name: 'Назад' }).click();
      await expect(page.getByTestId('settings-hero')).toContainText('Путница, имя Lucia');

      // Ссылка из раздела «Путник» ведёт к выбору голосов.
      await page.getByTestId('settings-hero').click();
      await page.getByRole('link', { name: '«Звук и озвучка»' }).click();
      await expect(page.getByTestId('settings-section')).toHaveAttribute('data-section', 'sound');
    });
  });
}
