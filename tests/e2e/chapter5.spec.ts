import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadLesson, loadPhraseData, openApp, playTrial, readAnswers, readMeta, scrollIdsOf, seedMissionsDone, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Упражнения всех уроков района C1: Хозяин Эха берёт задания из них. */
const c1 = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'grammar', 'c1'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => loadLesson(lang, 'c1', f.replace('.json', '')).exercises);

/** Выражения уровня 7 места. */
const expressions = (lang: Lang, place: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${place}.json`), 'utf8')).words as { id: string; level: number; kind?: string }[])
    .filter((w) => w.level === 7 && w.kind)
    .map((w) => w.id);

const GREETING = { es: 'Por fin alguien me contesta.', it: 'Finalmente qualcuno mi risponde.' } as const;

/** Открыта глава V, банк 5-го уровня, выучены слова уровней 1–7 банка, фразы уровня 7 и свиток главы V (карточки не к повторению). */
async function seedChapter5(page: Page, lang: Lang) {
  const ids = [
    ...wordIdsOf(lang, 'bank', [1, 2, 3, 4, 5, 6, 7]),
    ...loadPhraseData(lang, 'bank').filter((p) => p.level === 7).map((p) => p.id),
    ...scrollIdsOf(lang, 5),
  ];
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 30, reps: 3, due: 99999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          tx.objectStore('buildings').put({ locationId: 'bank', level: 5, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: 5, celebrated: 5 } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('испытание банка главы V: пять выражений, два — другим тоном, пройдено — обрывок карты Лабиринта', async ({ page }) => {
      await openApp(page, lang);
      await seedChapter5(page, lang);
      await seedMissionsDone(page, lang, ['ms:bank.5']);
      await page.goto('./#/');
      await page.reload();
      await page.goto('./#/trial/tr%3Abank.5');
      await expect(page.getByTestId('trial-echo')).toContainText('два из них нужно сказать другим тоном');
      await page.getByTestId('trial-start').click();
      const { total } = await playTrial(page, lang, 'bank');
      expect(total).toBe(15);
      await expect(page.getByTestId('trial-result')).toContainText('Испытание пройдено');
      const exprs = new Set(expressions(lang, 'bank'));
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log).toHaveLength(15);
      // «Эхо» записано на карточку выражения, всего выражений пять.
      const echo = log.filter((a) => a.kind === 'grammar-register');
      expect(echo).toHaveLength(2);
      expect(echo.every((a) => exprs.has(a.itemId))).toBe(true);
      expect(log.filter((a) => exprs.has(a.itemId))).toHaveLength(5);
      await expect.poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toContain('5:bank');
    });

    test('Хозяин Эха: ошибка, другой тон и другие слова; печать главы V и тайная медаль «Выход из Лабиринта»', async ({ page }) => {
      await openApp(page, lang);
      await seedChapter5(page, lang);
      await page.goto('./#/');
      await page.reload();
      await page.goto('./#/guardian/5');
      await expect(page.getByTestId('guardian-greeting')).toContainText(GREETING[lang]);
      await expect(page.getByTestId('guardian-kinds')).toContainText('таких заданий не меньше 6');
      await page.getByTestId('guardian-start').click();
      const { total } = await playTrial(page, lang, null, 0, c1(lang));
      expect(total).toBe(20);
      await expect(page.getByTestId('guardian-result')).toContainText('Печать главы V получена');
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      for (const k of ['fix', 'register', 'paraphrase']) expect(log.filter((a) => a.kind === `grammar-${k}`).length, k).toBeGreaterThanOrEqual(2);
      await expect.poll(async () => (await readMeta<{ seals: Record<string, number> }>(page, lang, 'journey'))?.seals).toHaveProperty('5');
      await expect
        .poll(async () => (await readMeta<{ medals: { secrets: Record<string, number> } }>(page, lang, 'motivation'))?.medals.secrets ?? {})
        .toHaveProperty('labyrinth');
      await page.goto('./#/medals');
      await expect(page.getByText('Выход из Лабиринта')).toBeVisible();
      await expect(page.getByText('Печать главы V')).toBeVisible();
    });
  });
}
