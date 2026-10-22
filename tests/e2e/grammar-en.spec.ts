import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerGrammar, openEnglish } from './fixtures';

/**
 * Английский курс закрыт (задачи 17.4, 17.6: есть слова и уроки A1–B1, но нет пролога и города): уроки открываются
 * напрямую, язык ставится в localStorage. Каждый урок проходится целиком, как в grammar.spec.ts.
 */
const ROOT = join(import.meta.dirname, '..', '..', 'src', 'content', 'en', 'grammar');
const CHAPTER: Record<string, number> = { a1: 1, a2: 2, b11: 3, b12: 3, b2: 4, c1: 5 };

for (const district of readdirSync(ROOT)) {
  for (const file of readdirSync(join(ROOT, district)).filter((f) => f.endsWith('.json'))) {
    const lesson = JSON.parse(readFileSync(join(ROOT, district, file), 'utf8'));
    test(`en: урок ${lesson.id}: каждое задание засчитывается`, { tag: ['@content', '@en'] }, async ({ page }) => {
      await openEnglish(page);
      await page.goto(`./#/grammar/${lesson.id}`);
      if (CHAPTER[district] > 1) {
        // Урок закрыт главой I: замок на экране значит, что запуск закончился и путь уже записан.
        await expect(page.getByTestId('district-lock')).toBeVisible();
        await page.evaluate(
          (chapter) =>
            new Promise<void>((resolve) => {
              const r = indexedDB.open('eslacity-en');
              r.onsuccess = () => {
                const tx = r.result.transaction('meta', 'readwrite');
                tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
                tx.oncomplete = () => resolve();
              };
            }),
          CHAPTER[district],
        );
        await page.reload();
      }
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      for (let i = 0; i < lesson.exercises.length; i++) {
        const id = await answerGrammar(page, lesson);
        await expect(page.locator('.sheet[aria-live]'), id).toContainText('Верно!');
        await page.getByRole('button', { name: /дальше/i }).click();
      }
      await expect(page.getByText(/урок пройден/i)).toBeVisible();
      await expect(page.getByText('100%')).toBeVisible();
    });
  }
}
