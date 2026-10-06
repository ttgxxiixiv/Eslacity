import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, openApp, readMeta } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);

for (const lang of LANGS) {
  test.describe(lang, () => {
    const pairs = JSON.parse(readFileSync(join(CONTENT, lang, 'pairs.json'), 'utf8')) as { contrasts: { id: string }[] };

    test('Звонница: выбор противопоставлений, звон, ошибка возвращает пару, итог и «Слушатель»', async ({ page }) => {
      await openApp(page, lang, '/grammar');
      await page.getByTestId('bells-entry').click();
      await expect(page.getByTestId('bells-intro')).toBeVisible();
      for (const c of pairs.contrasts) await expect(page.getByTestId(`contrast-${c.id}`)).toHaveAttribute('aria-pressed', 'true');
      // Оставляем одно противопоставление: все задания — из него.
      const keep = pairs.contrasts[0].id;
      for (const c of pairs.contrasts.slice(1)) await page.getByTestId(`contrast-${c.id}`).click();
      await expect(page.getByTestId(`contrast-${pairs.contrasts[1].id}`)).toHaveAttribute('aria-pressed', 'false');
      await page.getByTestId('bells-start').click();

      const task = page.getByTestId('bells-task');
      for (let i = 0; i < 11; i++) {
        await expect(page.getByTestId('bells-progress')).toHaveText(new RegExp(`^${i + 1} / `));
        await expect(task).toHaveAttribute('data-contrast', keep);
        const heard = (await task.getAttribute('data-heard'))!;
        // Слово звучит само при показе задания.
        await expect.poll(async () => (await said(page)).at(-1)).toBe(heard);
        const options = page.getByTestId('bells-option');
        await expect(options).toHaveCount(2);
        if (i === 0) {
          // Первая ошибка: прозвучало другое слово, пара вернётся в конце.
          await options.and(page.locator(`:not([data-word="${heard}"])`)).click();
          await expect(page.getByText('Прозвучало другое слово')).toBeVisible();
          await expect(page.getByTestId('bells-progress')).toHaveText('1 / 11');
          await page.getByTestId('bells-both').click();
        } else {
          await options.and(page.locator(`[data-word="${heard}"]`)).click();
          await expect(page.getByText('Верно!')).toBeVisible();
        }
        await page.getByRole('button', { name: /Дальше/ }).click();
      }
      await expect(page.getByTestId('bells-result')).toContainText('Верно: 10 из 11');
      await expect(page.getByTestId('bells-misses')).toBeVisible();
      await expect.poll(async () => (await readMeta<{ listenCorrect?: number }>(page, lang, 'motivation'))?.listenCorrect).toBeGreaterThanOrEqual(10);
    });
  });
}
