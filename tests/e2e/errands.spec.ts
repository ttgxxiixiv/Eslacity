import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, playWords, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const npcs = (lang: Lang) =>
  JSON.parse(readFileSync(join(CONTENT, lang, 'npcs.json'), 'utf8')).npcs as {
    id: string; name: string; location: string; errands: string[]; greeting: { es: string }; warm: { es: string; ru: string }[];
  }[];
const words = (lang: Lang, loc: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${loc}.json`), 'utf8')).words as { id: string; level: number }[]).filter((w) => w.level <= 2);

/** Записать карточки (часть — к повтору сегодня), открыть здания и сбросить план поручений. */
async function seed(page: Page, lang: Lang, cards: { id: string; due: boolean }[], places: string[], rep: Record<string, number> = {}) {
  await page.evaluate(
    ({ db, cards, places, rep }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const c of cards) {
            tx.objectStore('cards').put({ wordId: c.id, ef: 2.5, interval: 3, reps: 2, due: c.due ? 0 : 99_999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          }
          for (const p of places) tx.objectStore('buildings').put({ locationId: p, level: 1, lastCollectedAt: Date.now() });
          // План поручений собирается заново, очки репутации — заданные.
          tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], cards, places, rep },
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
      await expect(page.getByTestId('continue')).toBeVisible();
      const lola = npcs(lang).find((n) => n.location === 'cafe')!;
      // Одно очко у Лолы: после поручения станет два — ступень «Знакомый».
      await seed(page, lang, [...cafe.map((w) => ({ id: w.id, due: true })), ...market.map((w) => ({ id: w.id, due: false }))], ['market'], { [lola.id]: 1 });
      await expect(page.getByTestId('errand-sign-cafe')).toBeVisible();
      await expect(page.getByTestId('errand-sign-market')).toBeVisible();

      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      const cards = page.getByTestId('errand-card');
      await expect(cards).toHaveCount(2);
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
      await expect(page.getByTestId('rank-up')).toContainText('Отношения стали ближе: Знакомый');
      const data = await readMeta<{ done: number; rep: Record<string, number>; active: { location: string }[] }>(page, lang, 'errands');
      expect(data?.done).toBe(1);
      expect(data?.rep[lola.id]).toBe(2);
      expect(data?.active.map((e) => e.location)).toEqual(['market']);

      await page.getByRole('button', { name: /готово/i }).click();
      await page.getByRole('link', { name: 'Повтор', exact: true }).click();
      await expect(page.getByTestId('errand-card')).toHaveCount(1);
      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=courier]')).toContainText('Дерево');
    });

    test('репутация: тёплое приветствие, скидка на улучшение, новая ступень после поручения', async ({ page }) => {
      await openApp(page, lang);
      const lola = npcs(lang).find((n) => n.location === 'cafe')!;
      const cafe = words(lang, 'cafe').filter((w) => w.level === 1);
      // Приятель (5 очков), выучен уровень 1 кафе, есть монеты на улучшение.
      await page.evaluate(
        ({ db, ids, npc }) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction(['cards', 'meta'], 'readwrite');
              for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 3, reps: 2, due: 99_999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
              tx.objectStore('meta').put({ key: 'coins', value: 500 });
              tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: { [npc]: 5 } } });
              tx.oncomplete = () => resolve();
            };
          }),
        { db: DB[lang], ids: cafe.map((w) => w.id), npc: lola.id },
      );
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await page.goto('./#/loc/cafe');
      const card = page.getByTestId('npc-card');
      await expect(card.getByTestId('npc-greeting')).toContainText(lola.warm[0].es);
      await expect(card.getByTestId('npc-rank')).toContainText('Приятель');
      await expect(card.getByTestId('npc-rank')).toContainText('ещё 5 поручений');
      await expect(page.getByTestId('rep-discount')).toContainText(`Скидка от ${lola.name}: вместо 80 — 76`);
      await page.getByRole('button', { name: /Улучшить за/ }).click();
      // Списано 76, а не 80; плюс 10 за деревянную медаль «Строитель», которую даёт само улучшение.
      await expect.poll(() => readMeta<number>(page, lang, 'coins')).toBe(500 - 76 + 10);
    });
  });
}
