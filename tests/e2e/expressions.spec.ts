import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, playWords, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

interface Entry {
  id: string;
  level: number;
  kind?: string;
  register?: string;
  literal?: string;
}

const level7 = (lang: Lang, place: string): Entry[] =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${place}.json`), 'utf8')).words as Entry[]).filter((w) => w.level === 7);

/** Открыта глава V, банк 5-го уровня, выучены слова банка уровней 1–6 (карточки не к повторению). */
async function seedChapter5(page: Page, lang: Lang) {
  const ids = wordIdsOf(lang, 'bank', [1, 2, 3, 4, 5, 6]);
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 30, reps: 3, due: 99999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          tx.objectStore('buildings').put({ locationId: 'bank', level: 5, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: 5, celebrated: 5 } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('уровень 7 банка: выражения с метками регистра, урок выражений проходится', async ({ page }) => {
      const entries = level7(lang, 'bank');
      const expressions = entries.filter((w) => w.kind);
      expect(entries.length - expressions.length).toBe(25);
      expect(expressions).toHaveLength(15);

      await openApp(page, lang);
      await seedChapter5(page, lang);
      await page.goto('./#/');
      await page.reload();
      await page.goto('./#/loc/bank');
      const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Уровень 7' }) });
      await expect(section).toContainText('0/40 слов и выражений');
      await expect(section.getByTestId('word-tags').first()).toBeVisible();

      // Последний урок уровня — только выражения (40 записей по 6 на урок, выражения идут после слов).
      const lessons = section.getByRole('link', { name: /^Урок \d/ });
      await expect(lessons).toHaveCount(7);
      await lessons.last().click();
      await expect(page.getByText('Новое выражение')).toBeVisible();
      await expect(page.getByTestId('word-tags')).toBeVisible();
      await playWords(page, lang, /урок пройден/i);

      // Выученные выражения видны в «Моих словах» с метками.
      await page.goto('./#/words');
      await expect(page.getByTestId('word-tags').first()).toBeVisible();
      const learned = expressions.slice(-4);
      const idiom = learned.find((w) => w.kind === 'idiom' || w.kind === 'false-friend');
      if (idiom) await expect(page.getByTestId('word-tags').filter({ hasText: idiom.kind === 'idiom' ? 'идиома' : 'ложный друг' }).first()).toBeVisible();
    });
  });
}
