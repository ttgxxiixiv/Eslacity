import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadWords, openApp, seedDueCards, type Lang } from './fixtures';

/** Экран «Мой путь» (задача 14.5): точность по навыкам, минуты, слова по главам, прогноз и слабые места. */

async function seedAnswers(page: Page, lang: Lang, rows: { itemId: string; kind: string; verdict: string; ms: number }[]) {
  await page.evaluate(
    ({ db, rows }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('answers', 'readwrite');
          const now = Date.now();
          rows.forEach((row, i) => tx.objectStore('answers').add({ ...row, mode: 'review', ts: now - 60_000 + i }));
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], rows },
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('мой путь: точность, минуты, слова по главам, слабые места и «Разобрать»', async ({ page }) => {
      await openApp(page, lang, '/profile');
      await page.getByTestId('profile-path').click();
      // Журнал пуст: точности нет, слабых мест нет.
      await expect(page.getByTestId('path-skill')).toHaveCount(4);
      await expect(page.getByTestId('path-skill-value').first()).toHaveText('— · —');
      await expect(page.getByTestId('path-weak')).toContainText('ошибок почти нет');
      await expect(page.getByTestId('path-chapter')).toHaveCount(5);
      await expect(page.getByTestId('path-chapter-value').first()).toHaveText(/^0 \/ \d+$/);
      await expect(page.getByTestId('review-forecast')).toBeVisible();

      const words = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 5);
      await page.goto('./#/');
      await seedDueCards(page, lang, words.map((w) => w.id));
      await seedAnswers(page, lang, [
        ...words.map((w) => ({ itemId: w.id, kind: 'type', verdict: 'wrong', ms: 30_000 })),
        { itemId: words[0].id, kind: 'listen-choice', verdict: 'correct', ms: 30_000 },
      ]);
      await page.reload();
      await page.goto('./#/path');

      // Ввод: 0 из 5, слух: 1 из 1.
      const value = (skill: string) => page.locator(`[data-skill="${skill}"]`).getByTestId('path-skill-value');
      await expect(value('type')).toHaveText('0% · 0%');
      await expect(value('listen')).toHaveText('100% · 100%');
      await expect(value('grammar')).toHaveText('— · —');
      // Шесть ответов по 30 секунд — три минуты сегодня.
      await expect(page.getByTestId('path-minutes-day').last()).toContainText('3');
      await expect(page.getByTestId('path-chapter-value').first()).toHaveText(/^5 \/ \d+$/);

      const weak = page.getByTestId('path-weak-item');
      await expect(weak).toHaveCount(5);
      await expect(weak.first()).toContainText(words[0].ru);
      await expect(weak.first()).toContainText('ошибок 1');
      await page.getByTestId('path-weak-fix').click();
      await expect(page).toHaveURL(/#\/mistakes$/);
    });
  });
}
