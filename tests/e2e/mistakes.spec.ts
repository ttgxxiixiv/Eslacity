import { expect, test, type Page } from '@playwright/test';
import { ADVERB, DB, LANGS, loadWords, openApp, playWords, readAnswers, readMeta, seedDueCards, type Lang } from './fixtures';

/**
 * Работа над ошибками (задача 12.2): Летописец раз в день даёт «Разбор ошибок» по журналу ответов —
 * слабые места в том виде задания, где ошибались.
 */

/** Записать в журнал ответы и перезагрузить. */
async function seedAnswers(page: Page, lang: Lang, rows: { itemId: string; kind: string; verdict: string }[]) {
  await page.evaluate(
    ({ db, rows }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('answers', 'readwrite');
          const now = Date.now();
          rows.forEach((row, i) => tx.objectStore('answers').add({ ...row, mode: 'review', ms: 3000, ts: now - 3600_000 + i }));
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], rows },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('разбор ошибок: слабые места из журнала, вид задания — где ошибались, раз в день', async ({ page }) => {
      await openApp(page, lang);
      await page.goto('./#/errands');
      // Журнал пуст: разбирать нечего.
      await expect(page.getByTestId('errands-empty')).toBeVisible();
      await expect(page.getByTestId('mistakes-card')).toHaveCount(0);

      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 5).map((w) => w.id);
      await page.goto('./#/');
      await seedDueCards(page, lang, ids);
      // Все пять — ошибки ввода; шестое слово уже исправлено (два верных ответа подряд) и в разбор не идёт.
      await seedAnswers(page, lang, [
        ...ids.map((itemId) => ({ itemId, kind: 'type', verdict: 'wrong' })),
        { itemId: ids[0], kind: 'type', verdict: 'wrong' },
      ]);

      await page.goto('./#/errands');
      const card = page.getByTestId('mistakes-card');
      await expect(card).toContainText('Разбор ошибок');
      await expect(card).toContainText('5 заданий');
      await card.click();
      const played = await playWords(page, lang, /ошибки разобраны/i);
      // Все задания — ввод, как там, где ошибались.
      expect(Object.keys(played.kinds)).toEqual([`Напишите ${ADVERB[lang]}`]);
      await expect(page.getByTestId('mistakes-thanks')).toContainText('+20 🪙');
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'review' && a.ms !== 3000);
      expect(log.map((a) => a.kind)).toEqual(Array(5).fill('type'));
      expect((await readMeta<{ mistakes: number }>(page, lang, 'errands'))?.mistakes).toBeGreaterThan(0);

      // До завтра разбора нет.
      await page.goto('./#/errands');
      await expect(page.getByTestId('mistakes-card')).toHaveCount(0);
      await page.goto('./#/mistakes');
      await expect(page.getByTestId('mistakes-none')).toContainText('уже разобраны');
    });
  });
}
