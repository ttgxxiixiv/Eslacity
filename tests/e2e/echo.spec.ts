import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, exact, LANGS, openApp, phraseTiles, readAnswers, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
interface Expr { id: string; es: string; pair?: string; level: number }
/** Выражения места с парой в другом регистре. */
const paired = (lang: Lang, loc: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${loc}.json`), 'utf8')).words as Expr[]).filter((w) => w.level === 7 && w.pair);

/** Открыта глава `chapter` (по умолчанию V), у банка здание, выражения с парой — карточки к повтору: свежие (выбор) и закрепившиеся (плитки). */
async function seed(page: Page, lang: Lang, cards: { id: string; interval: number }[], chapter = 5) {
  await page.evaluate(
    ({ db, cards, chapter }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const c of cards) {
            tx.objectStore('cards').put({ wordId: c.id, ef: 2.5, interval: c.interval, reps: 2, due: 0, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          }
          tx.objectStore('buildings').put({ locationId: 'bank', level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
          tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: {} } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], cards, chapter },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('«Эхо» в главе V: житель говорит выражение, герой повторяет в другом регистре; медаль «Эхо»', async ({ page }) => {
      const exprs = paired(lang, 'bank');
      expect(exprs).toHaveLength(6);
      const byId = Object.fromEntries(exprs.map((w) => [w.id, w]));
      await openApp(page, lang);
      await seed(page, lang, exprs.map((w, i) => ({ id: w.id, interval: i % 2 ? 1 : 5 })));

      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      const card = page.getByTestId('errand-card');
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId('echo-tag')).toBeVisible();
      await expect(card.getByTestId('errand-text')).toContainText('6 выражений');
      await card.click();

      const seen = new Set<string>();
      let tiles = 0;
      for (let i = 0; i < 6; i++) {
        await expect(page.getByText(`Эхо · ${i + 1} из 6`)).toBeVisible();
        const exId = (await page.locator('[data-ex]').first().getAttribute('data-ex')) ?? '';
        const target = byId[exId.replace('echo:', '')];
        expect(target, exId).toBeTruthy();
        seen.add(target.id);
        // Житель говорит пару выражения.
        await expect(page.locator('[data-ex]').first()).toContainText(byId[target.pair!].es);
        if (await page.getByTestId('grammar-tiles').count()) {
          tiles++;
          for (const t of phraseTiles(target.es)) {
            await page.getByTestId('grammar-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
          }
          await page.getByRole('button', { name: 'Проверить' }).click();
        } else {
          await page.locator('button.min-h-14').filter({ hasText: exact(target.es) }).click();
        }
        await expect(page.locator('.sheet[aria-live]')).toContainText('Верно!');
        await page.getByRole('button', { name: /дальше/i }).click();
      }
      expect(seen.size).toBe(6);
      // Закрепившиеся выражения собираются из плиток, свежие выбираются.
      expect(tiles).toBe(3);

      await expect(page.getByText(/поручение выполнено/i)).toBeVisible();
      await expect(page.getByTestId('echo-summary')).toContainText('6 из 6');
      await expect(page.getByTestId('errand-thanks')).toBeVisible();
      const data = await readMeta<{ echo: number; done: number }>(page, lang, 'errands');
      expect(data?.echo).toBe(6);
      expect(data?.done).toBe(1);
      const kinds = (await readAnswers(page, lang)).map((a) => a.kind);
      expect(kinds.filter((k) => k === 'echo-register')).toHaveLength(6);

      await page.getByRole('button', { name: /готово/i }).click();
      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=echo]')).toContainText('Дерево');
      await expect(page.getByTestId('medals').locator('[data-line=echo]')).toContainText('6 / 10');
    });

    test('до главы V «Эха» нет: выражения идут обычным поручением', async ({ page }) => {
      const exprs = paired(lang, 'bank');
      await openApp(page, lang);
      await seed(page, lang, exprs.map((w) => ({ id: w.id, interval: 5 })), 4);
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      await expect(page.getByTestId('errand-card')).toHaveCount(1);
      await expect(page.getByTestId('echo-tag')).toHaveCount(0);
    });
  });
}
