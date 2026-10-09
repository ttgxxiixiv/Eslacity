import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

const npcOf = (lang: Lang, loc: string) =>
  (JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'npcs.json'), 'utf8')).npcs as { id: string; name: string; location: string }[])
    .find((n) => n.location === loc)!;

/** 5000 монет, жительница кафе — «Приятель» (5 очков), открыта глава `chapter`. */
async function seed(page: Page, lang: Lang, chapter: number) {
  const npc = npcOf(lang, 'cafe');
  await page.evaluate(
    ({ db, npc, chapter }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          const meta = tx.objectStore('meta');
          meta.put({ key: 'coins', value: 5000 });
          meta.put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: { [npc]: 5 } } });
          meta.put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], npc: npc.id, chapter },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('лавка: жетоны, подарок приятелю раз в неделю, украшение на карту города', async ({ page }) => {
      const npc = npcOf(lang, 'cafe');
      await openApp(page, lang);
      await seed(page, lang, 1);
      await page.goto('./#/profile');
      await expect(page.getByTestId('profile-shop')).toContainText('5000');
      await page.getByTestId('profile-shop').click();
      const coins = page.getByTestId('shop-coins');
      await expect(coins).toContainText('5000');

      const hintsBefore = (await readMeta<{ hints: number }>(page, lang, 'rewards'))?.hints ?? 0;
      await page.getByTestId('shop-hints').getByRole('button').click();
      await expect(coins).toContainText('4970');
      await expect(page.getByTestId('shop-said')).toContainText('жетона подсказки');
      await expect.poll(async () => (await readMeta<{ hints: number }>(page, lang, 'rewards'))?.hints).toBe(hintsBefore + 3);

      // Подарок: только приятелю, потом неделю нельзя.
      const gifts = page.getByTestId('shop-gift');
      await expect(gifts).toHaveCount(1);
      await expect(gifts).toContainText(npc.name);
      await gifts.getByRole('button').click();
      await expect(coins).toContainText('4920');
      await expect(page.getByTestId('shop-said')).toContainText(npc.name);
      await expect(gifts).toContainText('снова через 7 дней');
      await expect(gifts.getByRole('button')).toBeDisabled();
      await expect.poll(async () => (await readMeta<{ rep: Record<string, number> }>(page, lang, 'errands'))?.rep[npc.id]).toBe(6);

      // Украшение за 3000: ставится у здания на карте города.
      const decor = page.getByTestId('shop-decor');
      await expect(decor).toHaveCount(12);
      await decor.first().getByRole('button').click();
      await expect(coins).toContainText('1920');
      await expect(decor).toHaveCount(11);
      await expect(decor.first().getByRole('button')).toBeDisabled();
      await expect.poll(async () => (await readMeta<{ boughtDecor: string[] }>(page, lang, 'rewards'))?.boughtDecor).toEqual(['words']);
      await page.goto('./#/');
      await expect(page.getByTestId('city-decor')).toHaveCount(1);
      await expect(page.getByTestId('city-decor')).toHaveAttribute('data-line', 'words');
    });

    test('цены растут с главой', async ({ page }) => {
      await openApp(page, lang);
      await seed(page, lang, 3);
      await page.goto('./#/shop');
      await expect(page.getByTestId('shop-hints').getByRole('button')).toContainText('90');
      await expect(page.getByTestId('shop-gift').getByRole('button')).toContainText('150');
      await expect(page.getByTestId('shop-decor').first().getByRole('button')).toContainText('9000');
      await expect(page.getByTestId('shop-decor').first().getByRole('button')).toBeDisabled();
    });
  });
}
