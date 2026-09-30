import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Line = { who: string; es: string; ru: string };
const vault = (lang: Lang) => (JSON.parse(readFileSync(join(CONTENT, lang, 'sphinx.json'), 'utf8')).sphinx.vault as { before: Line[]; after: Line[] });

/** Два слова и одно выражение банка: итоги считают их отдельно. */
const CARDS: Record<Lang, { words: string[]; expressions: string[] }> = {
  es: { words: ['bank.banco', 'bank.dinero'], expressions: ['bank.proceder_al_pago'] },
  it: { words: ['bank.banca', 'bank.soldi'], expressions: ['bank.procedere_al_pagamento'] },
};

/** Пять печатей; `solved` — Сфинкс пропустил героя. Карточки выучены десять дней назад. */
async function seedVault(page: Page, lang: Lang, solved: boolean) {
  const ids = [...CARDS[lang].words, ...CARDS[lang].expressions];
  const learnedAt = Date.now() - 10 * 86_400_000;
  await page.evaluate(
    ({ db, ids, learnedAt, solved }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'meta'], 'readwrite');
          for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 30, reps: 3, due: 99999, lapses: 0, learnedAt, lastReviewedAt: learnedAt });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, openedChapter: 5, celebrated: 5 } });
          if (solved) {
            tx.objectStore('meta').put({ key: 'sphinx', value: { visited: 1, hearts: 3, rounds: { hear: 1, word: 1, wisdom: 1 }, attempts: { hear: 1, word: 1, wisdom: 1 }, done: 1 } });
          }
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids, learnedAt, solved },
  );
  await page.goto('./#/');
  await page.reload();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    const v = vault(lang);

    test('Хранилище закрыто, пока Сфинкс не пропустил', async ({ page }) => {
      await openApp(page, lang);
      await seedVault(page, lang, false);
      await page.goto('./#/vault');
      await expect(page.getByTestId('vault-closed')).toBeVisible();
    });

    test('Эликсир: сцена, золотой медальон, титул «Мудрец», медаль «Хранитель пути», итоги пути', async ({ page }) => {
      await openApp(page, lang);
      await seedVault(page, lang, true);
      await expect(page.locator('nav img')).not.toHaveAttribute('data-gold', 'true');
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('gates-status')).toContainText('ждёт Эликсир');
      await page.getByTestId('gates-go').click();

      // До Эликсира: Сфинкс и Летописец, перевод по нажатию.
      await expect(page.getByTestId('vault-line')).toContainText(v.before[0].es);
      await page.getByTestId('vault-line').click();
      await expect(page.getByTestId('vault-line-ru')).toContainText(v.before[0].ru);
      for (let i = 1; i < v.before.length; i++) {
        await page.getByTestId('vault-next').click();
        await expect(page.getByTestId('vault-line')).toContainText(v.before[i].es);
      }
      await page.getByTestId('vault-next').click();
      await page.getByTestId('drink').click();

      // После: золотой медальон и новый титул.
      await expect(page.getByTestId('vault-title')).toHaveText('Мудрец');
      await expect(page.getByTestId('vault-line')).toContainText(v.after[0].es);
      await expect
        .poll(async () => (await readMeta<{ medals: { secrets: Record<string, number> } }>(page, lang, 'motivation'))?.medals.secrets ?? {})
        .toHaveProperty('keeper');
      await expect.poll(async () => (await readMeta<{ elixir?: number }>(page, lang, 'sphinx'))?.elixir).toBeGreaterThan(0);
      for (let i = 1; i < v.after.length; i++) await page.getByTestId('vault-next').click();
      await page.getByTestId('vault-next').click();

      const summary = page.getByTestId('vault-summary');
      await expect(summary).toContainText('Путь к Хранилищу пройден за 11 дней');
      await expect(page.getByTestId('summary-Слов')).toHaveText('2');
      await expect(page.getByTestId('summary-Устойчивых выражений')).toHaveText('1');
      await expect(page.getByTestId('summary-seals').locator('li')).toHaveText(['I', 'II', 'III', 'IV', 'V']);

      // В городе медальон меню золотой, у героя титул «Мудрец».
      await page.goto('./#/');
      await expect(page.locator('nav img')).toHaveAttribute('data-gold', 'true');
      await expect(page.getByTestId('level-badge')).toHaveAttribute('aria-label', /^Мудрец, уровень/);

      // После перезапуска Хранилище сразу показывает итоги, сцену можно пересмотреть.
      await page.reload();
      await page.goto('./#/vault');
      await expect(page.getByTestId('vault-summary')).toBeVisible();
      await page.getByTestId('vault-replay').click();
      await expect(page.getByTestId('vault-line')).toContainText(v.before[0].es);
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('gates-status')).toContainText('Эликсир выпит');
    });
  });
}
