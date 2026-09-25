import { expect, test } from '@playwright/test';
import { answerGrammar, LANGS, loadLesson, openApp, playWords } from './fixtures';

const GRAMMAR = { es: 'a1.02-ser', it: 'a1.02-essere' } as const;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('урок слов целиком: все правильные ответы засчитаны', async ({ page }) => {
      await openApp(page, lang, '/learn/cafe/1/0');
      const { kinds, verdicts } = await playWords(page, lang, /урок пройден/i);
      expect(verdicts.correct).toBeGreaterThan(10);
      // В первом уроке есть знакомство, выбор, ввод и пары.
      expect(Object.keys(kinds).length).toBeGreaterThanOrEqual(5);
      await expect(page.getByText(/урок пройден/i)).toBeVisible();
    });

    test('урок грамматики целиком и «Перечитать теорию»', async ({ page }) => {
      const [district, file] = GRAMMAR[lang].split('.');
      const lesson = loadLesson(lang, district, file);
      await openApp(page, lang, `/grammar/${GRAMMAR[lang]}`);
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      for (let i = 0; i < lesson.exercises.length; i++) {
        await answerGrammar(page, lesson);
        await expect(page.locator('[aria-live]').first()).toContainText(/верно/i);
        await page.getByRole('button', { name: /дальше/i }).click();
      }
      await expect(page.getByText(/урок пройден/i)).toBeVisible();
      await expect(page.getByText('100%')).toBeVisible();
      // Раньше после перечитывания теории экран падал.
      await page.getByRole('button', { name: /перечитать теорию/i }).click();
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      await expect(page.locator('button.min-h-14').first()).toBeVisible();
    });
  });
}
