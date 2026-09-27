import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerGrammar, LANGS, loadLesson, openApp, readAnswers } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Районы с продуктивными заданиями: уроки проходятся целиком (задача 5.3 идёт пачками по району). */
const DISTRICTS = ['a1'];

for (const lang of LANGS) {
  test.describe(lang, () => {
    for (const district of DISTRICTS) {
      const files = readdirSync(join(CONTENT, lang, 'grammar', district)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
      for (const file of files) {
        test(`урок ${district}.${file}: каждое задание, со сборкой и вводом формы, засчитывается`, async ({ page }) => {
          const lesson = loadLesson(lang, district, file);
          await openApp(page, lang, `/grammar/${lesson.id}`);
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
