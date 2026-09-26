import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, seedDueCards, type Lang } from './fixtures';

const npcName = (lang: Lang, loc: string) =>
  (JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'npcs.json'), 'utf8')).npcs as { name: string; location: string }[])
    .find((n) => n.location === loc)!.name;

/** Отметить, сколько новых слов выучено сегодня. */
async function newToday(page: Page, lang: Lang, n: number) {
  await page.evaluate(
    ({ db, n }) =>
      new Promise<void>((resolve) => {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('days', 'readwrite');
          tx.objectStore('days').put({ date, xp: 0, newWords: n, reviews: 0, lessons: 1, grammarLessons: 0 });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], n },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('новые слова — просьба жителя, дневной лимит мягкий и настраивается', async ({ page }) => {
      await openApp(page, lang);
      const cont = page.getByTestId('continue');
      await expect(cont).toContainText(`Просьба: ${npcName(lang, 'cafe')}`);
      await expect(cont).toContainText('Выучить');

      // Лимит 10 набран, но повторять нечего — лимит не мешает.
      await newToday(page, lang, 10);
      await expect(cont).toContainText(`Просьба: ${npcName(lang, 'cafe')}`);
      // Есть что повторить: сначала поручения, но учить дальше можно.
      await seedDueCards(page, lang, ['cafe.fake-a', 'cafe.fake-b']);
      await expect(cont).toHaveAttribute('data-kind', 'errands');
      await expect(cont).toContainText('Новых слов на сегодня хватит');
      await expect(page.getByTestId('learn-anyway')).toHaveAttribute('href', /#\/learn\/cafe\/1\/0$/);
      // Кнопка карты по высоте равна карточке квеста, ссылка «Всё равно учить» под ними не растягивает её.
      const cardH = (await cont.boundingBox())!.height;
      expect(Math.abs((await page.getByTestId('map-button').boundingBox())!.height - cardH)).toBeLessThan(1);

      // Лимит 20 в настройках: снова урок.
      await page.goto('./#/settings');
      await page.getByTestId('new-per-day').getByRole('button', { name: '20' }).click();
      await page.goto('./#/');
      await expect(cont).toContainText(`Просьба: ${npcName(lang, 'cafe')}`);

      // Повторов больше 20 × 5: сначала поручения.
      const ids = Array.from({ length: 101 }, (_, i) => `cafe.fake${i}`); // плюс две из прошлого шага — 103
      await seedDueCards(page, lang, ids);
      await expect(cont).toHaveAttribute('data-kind', 'errands');
      await expect(cont).toContainText('Накопилось 103 слова к повтору');

      await page.goto('./#/loc/cafe');
      await expect(page.getByTestId('learn-request').first()).toContainText(`${npcName(lang, 'cafe')} просит выучить`);
    });
  });
}
