import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, wordIdsOf, type Lang } from './fixtures';

/** Кафе 5-го уровня, выучены слова уровней 1–5, открыта глава `opened`. */
async function seed(page: Page, lang: Lang, opened: number) {
  const learned = wordIdsOf(lang, 'cafe', [1, 2, 3, 4, 5]);
  await page.evaluate(
    ({ db, ids, opened }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          // Карточки выучены давно и повторять их пока не нужно.
          for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 30, reps: 3, due: 99999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          tx.objectStore('buildings').put({ locationId: 'cafe', level: 5, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: opened, celebrated: opened } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids: learned, opened },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('уровень 6 (B2): закрыт до главы IV, потом открыт без улучшения здания', async ({ page }) => {
      const six = wordIdsOf(lang, 'cafe', [6]);
      expect(six).toHaveLength(30);
      await openApp(page, lang);

      // Глава III: уровень 6 виден, но ждёт главу IV, кнопки «Улучшить» нет.
      await seed(page, lang, 3);
      await page.goto('./#/loc/cafe');
      const level6 = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Уровень 6' }) });
      await expect(level6.getByTestId('chapter-lock')).toContainText('Откроется в главе IV');
      await expect(page.getByRole('button', { name: /Улучшить/ })).toHaveCount(0);
      await page.goto('./#/');
      await expect(page.getByTestId('continue')).not.toHaveAttribute('href', /\/learn\/cafe\/6\//);

      // Глава IV: пять уроков уровня 6, житель просит выучить 30 слов, «Продолжить» ведёт на первый.
      await seed(page, lang, 4);
      await expect(page.getByTestId('continue')).toHaveAttribute('href', /#\/learn\/cafe\/6\/0$/);
      await page.goto('./#/loc/cafe');
      await expect(level6.getByTestId('learn-request')).toContainText('30');
      await expect(level6.getByRole('link', { name: /Урок \d/ })).toHaveCount(5);
      await level6.getByRole('link', { name: /Урок 1/ }).click();
      await expect(page).toHaveURL(/#\/learn\/cafe\/6\/0$/);
    });
  });
}
