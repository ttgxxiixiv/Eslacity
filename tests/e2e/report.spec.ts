import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('отчёт об ошибке: из итога ответа и из разговора, копирование и очистка в настройках', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await openApp(page, lang, '/bells');
      await page.getByTestId('bells-start').click();
      const heard = (await page.getByTestId('bells-task').getAttribute('data-heard'))!;
      const contrast = (await page.getByTestId('bells-task').getAttribute('data-contrast'))!;
      await page.getByTestId('bells-option').and(page.locator(`[data-word="${heard}"]`)).click();

      // Итог ответа: кнопка отчёта, причина и комментарий.
      await page.getByTestId('report-open').click();
      await expect(page.getByTestId('report-dialog')).toContainText(heard);
      await page.getByTestId('report-reason-audio').click();
      await page.getByTestId('report-note').fill('звучит неразборчиво');
      await page.getByTestId('report-send').click();
      await expect(page.getByTestId('report-sent')).toBeVisible();
      // У следующего задания кнопка снова своя.
      await page.getByRole('button', { name: /Дальше/ }).click();
      const heard2 = (await page.getByTestId('bells-task').getAttribute('data-heard'))!;
      await page.getByTestId('bells-option').and(page.locator(`[data-word="${heard2}"]`)).click();
      await expect(page.getByTestId('report-open')).toBeVisible();

      // Разговор: отчёт о реплике.
      await page.goto('./#/scene/sc%3Acafe.1');
      await page.getByTestId('report-open').click();
      await page.getByTestId('report-send').click();
      await expect(page.getByTestId('report-sent')).toBeVisible();

      await page.goto('./#/settings/reports');
      await expect(page.getByTestId('reports-count')).toHaveText('Сохранено: 2 отчёта');
      await page.getByTestId('reports-copy').click();
      await expect(page.getByTestId('reports-copy')).toHaveText('Скопировано');
      const text = await page.evaluate(() => navigator.clipboard.readText());
      const lines = text.split('\n');
      expect(lines[0]).toMatch(new RegExp(`^Eslacity \\d+\\.\\d+\\.\\d+ · ${lang} · отчётов: 2$`));
      expect(lines[1]).toContain(`mp:${contrast}.`);
      expect(lines[1]).toContain('Озвучка: звучит неразборчиво');
      expect(lines[2]).toContain('sc:cafe.1#0');
      expect(lines[2]).toContain('Неверный перевод');

      page.once('dialog', (d) => d.accept());
      await page.getByTestId('reports-clear').click();
      await expect(page.getByTestId('reports-count')).toHaveText('Отчётов пока нет');
    });
  });
}
