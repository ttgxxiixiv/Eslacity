import { expect, test } from '@playwright/test';
import { answerGrammar, LANGS, loadLesson, loadWords, openApp, playWords, readAnswers, seedDueCards } from './fixtures';

const LESSON = { es: ['a1', '02-ser'], it: ['a1', '02-essere'] } as const;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('повторение: карточки к повтору проходятся и уходят', async ({ page }) => {
      await openApp(page, lang);
      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 10).map((w) => w.id);
      await seedDueCards(page, lang, ids);
      await page.goto('./#/review');
      await playWords(page, lang, /повторение завершено/i);
      await expect.poll(async () => (await readAnswers(page, lang)).filter((a) => a.mode === 'review').length).toBeGreaterThanOrEqual(10);
      await page.goto('./#/');
      await expect(page.getByText('На сегодня всё повторено')).toBeVisible();
    });

    test('правила: ошибка в уроке грамматики попадает в повторение, повторяются после слов', async ({ page }) => {
      const [district, file] = LESSON[lang];
      const lesson = loadLesson(lang, district, file);
      await openApp(page, lang, `/grammar/${lesson.id}`);
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      // Первое упражнение — нарочно неверно (оно вернётся в конец урока), остальные верно.
      const wrongId = await answerGrammar(page, lesson, true);
      await page.getByRole('button', { name: /дальше/i }).click();
      while (!(await page.getByText(/урок пройден/i).count())) {
        await answerGrammar(page, lesson);
        await page.getByRole('button', { name: /дальше/i }).click();
      }
      const rules = await page.evaluate(
        (db) =>
          new Promise<{ wordId: string; due: number; interval: number }[]>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const q = r.result.transaction('cards').objectStore('cards').getAll();
              q.onsuccess = () => resolve(q.result.filter((c: { wordId: string }) => c.wordId.startsWith('g:')));
            };
          }),
        lang === 'es' ? 'eslacity' : 'eslacity-it',
      );
      // Три карточки на урок, у ошибки — короткий интервал.
      expect(rules).toHaveLength(3);
      expect(rules.every((c) => c.wordId.startsWith(`g:${lesson.id}.`))).toBe(true);
      expect(rules.find((c) => c.wordId === `g:${wrongId}`)?.interval).toBe(1);
      expect(rules.filter((c) => c.wordId !== `g:${wrongId}`).every((c) => c.interval > 1)).toBe(true);

      // Правила и слова пора повторить: слово — сначала, правило — после, несуществующее правило уходит.
      const word = [...loadWords(lang).byEs.values()].find((w) => w.id.startsWith('cafe.'))!.id;
      await page.goto('./#/');
      await seedDueCards(page, lang, [word, rules[0].wordId, 'g:a1.99-nope.1']);
      await expect(page.getByText('1 слово и 2 правила на сегодня')).toBeVisible();
      await page.goto('./#/review');
      await playWords(page, lang, /Правило ·/);
      await expect(page.getByTestId('rule-review')).toContainText('Правило · 1 из 1');
      await answerGrammar(page, lesson);
      await page.getByRole('button', { name: /дальше/i }).click();
      await expect(page.getByText(/повторение завершено/i)).toBeVisible();
      await expect(page.getByTestId('rules-summary')).toContainText('Правила: 1 из 1 верно');
      const reviewed = (await readAnswers(page, lang)).filter((a) => a.mode === 'review');
      expect(reviewed.some((a) => a.itemId === rules[0].wordId && a.kind.startsWith('grammar-'))).toBe(true);
      await page.goto('./#/');
      await expect(page.getByText('На сегодня всё повторено')).toBeVisible();
    });

    test('блиц: игра и итог', async ({ page }) => {
      await openApp(page, lang);
      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 10).map((w) => w.id);
      await seedDueCards(page, lang, ids);
      await page.goto('./#/blitz');
      await page.getByRole('button', { name: 'Старт' }).click();
      for (let i = 0; i < 5; i++) {
        await page.locator('button.min-h-14').first().click();
        await page.waitForTimeout(700);
      }
      await page.getByRole('button', { name: 'Закончить' }).click();
      await expect(page.getByText('Ещё раз')).toBeVisible();
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'blitz');
      expect(log).toHaveLength(5);
      expect(log.every((a) => /^blitz-(es-ru|ru-es)$/.test(a.kind))).toBe(true);
    });
  });
}
