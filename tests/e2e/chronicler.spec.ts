import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DB, LANGS, openApp, playWords, readMeta, scrollIdsOf, seedDueCards } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

for (const lang of LANGS) {
  test.describe(lang, () => {
    const chronicler = JSON.parse(readFileSync(join(CONTENT, lang, 'chronicler.json'), 'utf8')) as { name: string; greeting: { es: string } };
    const scroll = scrollIdsOf(lang, 1);

    test('Летописец на карте странствий: просьба выучить слова свитка', async ({ page }) => {
      await openApp(page, lang, '/journey-map');
      const panel = page.getByTestId('chronicler');
      await expect(page.getByTestId('npc-card')).toContainText(chronicler.name);
      await expect(page.getByTestId('npc-greeting')).toContainText(chronicler.greeting.es);
      await expect(panel.getByTestId('scroll-count')).toHaveText(`0 / ${scroll.length}`);
      await expect(page.getByTestId('chronicler-limit')).toHaveCount(0);

      await panel.getByTestId('chronicler-lesson').click();
      await expect(page).toHaveURL(/#\/learn\/scroll1\/1\/0$/);
      await playWords(page, lang, /урок пройден/i);
      await page.getByRole('button', { name: /готово/i }).click();
      // После урока — обратно к Летописцу, в свитке шесть слов.
      await expect(page).toHaveURL(/#\/journey-map$/);
      await expect(panel.getByTestId('scroll-count')).toHaveText(`6 / ${scroll.length}`);
      await expect(panel.getByTestId('chronicler-lesson')).toContainText('6 новых слов');

      await page.getByRole('button', { name: /Печать главы/ }).click();
      await expect(page.getByTestId('seal-scroll')).toContainText(`осталось выучить ${scroll.length - 6} слов из ${scroll.length}`);
    });

    test('поручение Летописца, когда свитку пора повториться', async ({ page }) => {
      await openApp(page, lang);
      // План на сегодня уже собран при запуске, пока свитка не было: сбрасываем его.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: {} } });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await seedDueCards(page, lang, scroll);
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      const card = page.getByTestId('errand-card');
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(chronicler.name);
      await expect(card).toContainText('свиток земли');
      await card.click();
      await playWords(page, lang, /поручение выполнено/i);
      await expect(page.getByTestId('errand-thanks')).toContainText(chronicler.name);
      const data = await readMeta<{ done: number; active: unknown[] }>(page, lang, 'errands');
      expect(data?.done).toBe(1);
      expect(data?.active).toEqual([]);

      // Свиток выучен: Летописец больше не просит новых слов.
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('scroll-count')).toHaveText(`${scroll.length} / ${scroll.length}`);
      await expect(page.getByTestId('chronicler-lesson')).toHaveCount(0);
      await expect(page.getByTestId('chronicler')).toContainText('Свиток выучен');
    });
  });
}
