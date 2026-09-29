import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerGrammar, DB, LANGS, loadLesson, openApp, readAnswers } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Все районы: каждый урок проходится целиком, вместе со сборкой и вводом формы. */
const DISTRICTS = readdirSync(join(CONTENT, 'es', 'grammar'));
/** Глава, в которой открывается район: уроки следующих глав закрыты. */
const CHAPTER: Record<string, number> = { a1: 1, a2: 2, b11: 3, b12: 3, b2: 4, c1: 5 };

for (const lang of LANGS) {
  test.describe(lang, () => {
    for (const district of DISTRICTS) {
      const files = readdirSync(join(CONTENT, lang, 'grammar', district)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
      for (const file of files) {
        test(`урок ${district}.${file}: каждое задание, со сборкой и вводом формы, засчитывается`, async ({ page }) => {
          const lesson = loadLesson(lang, district, file);
          await openApp(page, lang);
          if (CHAPTER[district] > 1) {
            await page.evaluate(
              ({ db, chapter }) =>
                new Promise<void>((resolve) => {
                  const r = indexedDB.open(db);
                  r.onsuccess = () => {
                    const tx = r.result.transaction('meta', 'readwrite');
                    tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
                    tx.oncomplete = () => resolve();
                  };
                }),
              { db: DB[lang], chapter: CHAPTER[district] },
            );
          }
          await page.goto(`./#/grammar/${lesson.id}`);
          await page.reload();
          await page.getByRole('button', { name: /к упражнениям/i }).click();
          for (let i = 0; i < lesson.exercises.length; i++) {
            const id = await answerGrammar(page, lesson);
            await expect(page.locator('.sheet[aria-live]'), id).toContainText('Верно!');
            await page.getByRole('button', { name: /дальше/i }).click();
          }
          await expect(page.getByText(/урок пройден/i)).toBeVisible();
          await expect(page.getByText('100%')).toBeVisible();
          const kinds = (await readAnswers(page, lang)).map((a) => a.kind);
          expect(kinds.filter((k) => k === 'grammar-build')).toHaveLength(1);
          expect(kinds.filter((k) => k === 'grammar-type')).toHaveLength(1);
        });
      }
    }
  });
}
