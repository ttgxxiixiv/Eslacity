import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerGrammar, openCourse } from './fixtures';

/**
 * Уроки курсов без своего grammar.spec: турецкий (писался закрытым, задача 18.4) и закрытый португальский
 * (задача 19.4). Уроки открываются напрямую, язык ставится в localStorage, пролог и город не нужны.
 * Каждый урок проходится целиком, как в grammar.spec.ts.
 */
const COURSES = ['tr', 'pt'];
const CHAPTER: Record<string, number> = { a1: 1, a2: 2, b11: 3, b12: 3, b2: 4, c1: 5 };

for (const lang of COURSES) {
  const root = join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'grammar');
  for (const district of readdirSync(root)) {
    for (const file of readdirSync(join(root, district)).filter((f) => f.endsWith('.json'))) {
      const lesson = JSON.parse(readFileSync(join(root, district, file), 'utf8'));
      test(`${lang}: урок ${lesson.id}: каждое задание засчитывается`, async ({ page }) => {
        await openCourse(page, lang);
        await page.goto(`./#/grammar/${lesson.id}`);
        if (CHAPTER[district] > 1) {
          // Урок закрыт главой I: замок на экране значит, что запуск закончился и путь уже записан.
          await expect(page.getByTestId('district-lock')).toBeVisible();
          await page.evaluate(
            ({ chapter, db }) =>
              new Promise<void>((resolve) => {
                const r = indexedDB.open(db);
                r.onsuccess = () => {
                  const tx = r.result.transaction('meta', 'readwrite');
                  tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
                  tx.oncomplete = () => resolve();
                };
              }),
            { chapter: CHAPTER[district], db: `eslacity-${lang}` },
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
}
