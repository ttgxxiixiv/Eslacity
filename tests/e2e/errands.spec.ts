import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, playWords, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const npcs = (lang: Lang) =>
  JSON.parse(readFileSync(join(CONTENT, lang, 'npcs.json'), 'utf8')).npcs as { id: string; name: string; location: string; errands: string[] }[];
const words = (lang: Lang, loc: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${loc}.json`), 'utf8')).words as { id: string; level: number }[]).filter((w) => w.level <= 2);

/** Записать карточки (часть — к повтору сегодня), открыть здания и сбросить план поручений. */
async function seed(page: Page, lang: Lang, cards: { id: string; due: boolean }[], places: string[]) {
  await page.evaluate(
    ({ db, cards, places }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const c of cards) {
            tx.objectStore('cards').put({ wordId: c.id, ef: 2.5, interval: 3, reps: 2, due: c.due ? 0 : 99_999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          }
          for (const p of places) tx.objectStore('buildings').put({ locationId: p, level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').delete('errands');
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], cards, places },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('поручения: просьба жителя, знак на карте, выполнение и награда', async ({ page }) => {
      await openApp(page, lang);
      // Новичку просить не о чем.
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      await expect(page).toHaveURL(/#\/errands$/);
      await expect(page.getByTestId('errands-empty')).toBeVisible();

      const cafe = words(lang, 'cafe').slice(0, 10);
      const market = words(lang, 'market').slice(0, 9);
      await page.goto('./#/');
      await seed(page, lang, [...cafe.map((w) => ({ id: w.id, due: true })), ...market.map((w) => ({ id: w.id, due: false }))], ['market']);
      await expect(page.getByTestId('errand-sign-cafe')).toBeVisible();
      await expect(page.getByTestId('errand-sign-market')).toBeVisible();

      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      const cards = page.getByTestId('errand-card');
      await expect(cards).toHaveCount(2);
      const lola = npcs(lang).find((n) => n.location === 'cafe')!;
      const card = cards.filter({ hasText: lola.name });
      // Просьба звучит голосом жителя: одна из его формулировок с числом заданий.
      const text = (await card.getByTestId('errand-text').textContent()) ?? '';
      const heads = lola.errands.map((t) => t.split('{n}')[0].trim());
      expect(heads.some((h) => text.startsWith(h))).toBe(true);
      expect(text).toContain('10');

      await card.click();
      await playWords(page, lang, /поручение выполнено/i);
      await expect(page.getByTestId('errand-thanks')).toContainText(lola.name);
      await expect(page.getByTestId('errand-thanks')).toContainText('+30 🪙');
      const data = await readMeta<{ done: number; rep: Record<string, number>; active: { location: string }[] }>(page, lang, 'errands');
      expect(data?.done).toBe(1);
      expect(data?.rep[lola.id]).toBe(1);
      expect(data?.active.map((e) => e.location)).toEqual(['market']);

      await page.getByRole('button', { name: /готово/i }).click();
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      await expect(page.getByTestId('errand-card')).toHaveCount(1);
      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=courier]')).toContainText('Дерево');
    });
  });
}
