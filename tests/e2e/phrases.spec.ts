import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DB, LANGS, loadPhraseData, openApp, playPhrases, readMeta, seedDueCards, wordIdsOf } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

for (const lang of LANGS) {
  test.describe(lang, () => {
    const npc = (JSON.parse(readFileSync(join(CONTENT, lang, 'npcs.json'), 'utf8')).npcs as { name: string; location: string }[]).find(
      (n) => n.location === 'cafe',
    )!;
    const level1 = loadPhraseData(lang, 'cafe').filter((p) => p.level === 1);

    test('фразы кафе: урок у жителя, карточки ph:, повторение и поручение', async ({ page }) => {
      await openApp(page, lang, '/loc/cafe');
      const block = page.getByTestId('phrase-block').first();
      await expect(block).toContainText('Фразы откроются, когда выучены слова уровня.');

      // Слова уровня 1 выучены — житель учит фразам.
      await page.goto('./#/');
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1]));
      await page.goto('./#/loc/cafe');
      await expect(block.getByTestId('phrase-lesson')).toHaveText(`${npc.name} учит: 5 фраз`);
      await block.getByTestId('phrase-lesson').click();
      await expect(page).toHaveURL(/#\/phrases\/cafe\/1$/);
      const kinds = await playPhrases(page, lang, 'cafe', /фразы выучены/i);
      expect(kinds).toMatchObject({ 'Новая фраза': 5, 'Выберите фразу': 5, 'Соберите фразу из плиток': 5 });
      await expect(page.getByTestId('phrases-done')).toContainText(npc.name);
      await page.getByRole('button', { name: /готово/i }).click();
      await expect(page).toHaveURL(/#\/loc\/cafe$/);
      await expect(block).toContainText('5/5 фраз');
      await expect(block.getByTestId('phrase-lesson')).toHaveText('Повторить фразы уровня');

      // Фразы — отдельные карточки, словарь слов они не увеличивают.
      const ids = await page.evaluate(
        (db) =>
          new Promise<string[]>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const q = r.result.transaction('cards').objectStore('cards').getAllKeys();
              q.onsuccess = () => resolve(q.result as string[]);
            };
          }),
        DB[lang],
      );
      expect(ids.filter((id) => id.startsWith('ph:')).sort()).toEqual(level1.map((p) => p.id).sort());

      // Пора повторить только фразы: поручение Лолы (Джулии) из фраз.
      await page.goto('./#/');
      await page.evaluate(
        ({ db, words }) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction(['cards', 'meta'], 'readwrite');
              for (const id of words) tx.objectStore('cards').delete(id);
              tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: {} } });
              tx.oncomplete = () => resolve();
            };
          }),
        { db: DB[lang], words: wordIdsOf(lang, 'cafe', [1]) },
      );
      await seedDueCards(page, lang, level1.map((p) => p.id));
      await expect(page.getByTestId('continue')).toBeVisible();
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      const card = page.getByTestId('errand-card');
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(npc.name);
      await card.click();
      await playPhrases(page, lang, 'cafe', /поручение выполнено/i);
      await expect(page.getByTestId('phrases-summary')).toContainText('Фразы: 5 из 5 верно');
      await expect(page.getByTestId('errand-thanks')).toContainText(npc.name);
      expect((await readMeta<{ done: number }>(page, lang, 'errands'))?.done).toBe(1);
    });
  });
}
