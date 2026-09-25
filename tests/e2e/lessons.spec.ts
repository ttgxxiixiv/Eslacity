import { expect, test } from '@playwright/test';
import { answerGrammar, LANGS, loadLesson, openApp, playWords, readAnswers } from './fixtures';

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

      // Журнал: по записи на каждый ответ (в парах — на каждое слово), режим «урок».
      const pairs = kinds['Соедините пары'] ?? 0;
      await expect.poll(async () => (await readAnswers(page, lang)).length).toBeGreaterThanOrEqual(verdicts.correct - pairs);
      const log = await readAnswers(page, lang);
      expect(log.every((a) => a.mode === 'learn' && a.verdict === 'correct' && a.itemId.startsWith('cafe.'))).toBe(true);
      expect(log.every((a) => a.ms >= 0)).toBe(true);
      expect(new Set(log.map((a) => a.kind)).has('type')).toBe(true);
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
      await expect.poll(async () => (await readAnswers(page, lang)).length).toBe(lesson.exercises.length);
      const log = await readAnswers(page, lang);
      expect(log.every((a) => a.mode === 'grammar' && a.verdict === 'correct' && a.kind.startsWith('grammar-'))).toBe(true);
      // Каждое упражнение урока записано под своим номером.
      expect(new Set(log.map((a) => a.itemId)).size).toBe(lesson.exercises.length);
      expect(log.map((a) => a.itemId).sort()).toEqual(lesson.exercises.map((_, i) => `g:${lesson.id}.${i + 1}`).sort());
      // Раньше после перечитывания теории экран падал.
      await page.getByRole('button', { name: /перечитать теорию/i }).click();
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      await expect(page.locator('button.min-h-14').first()).toBeVisible();
    });
  });
}
