import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadLesson, loadPhraseData, openApp, playTrial, readAnswers, readMeta, seedMissionsDone, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Упражнения всех уроков района B2: Хранительница леса берёт задания из них. */
const b2 = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'grammar', 'b2'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => loadLesson(lang, 'b2', f.replace('.json', '')).exercises);

const GREETING = { es: 'Por fin oigo el camino.', it: 'Finalmente sento il sentiero.' } as const;

/** Открыта глава IV, кафе 5-го уровня, выучены слова уровней 1–6 кафе и фразы уровня 6 (карточки не к повторению). */
async function seedChapter4(page: Page, lang: Lang) {
  const ids = [...wordIdsOf(lang, 'cafe', [1, 2, 3, 4, 5, 6]), ...loadPhraseData(lang, 'cafe').filter((p) => p.level === 6).map((p) => p.id)];
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const id of ids) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 30, reps: 3, due: 99999, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          tx.objectStore('buildings').put({ locationId: 'cafe', level: 5, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: 4, celebrated: 4 } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('испытание кафе главы IV: слова и фразы уровня 6, пройдено — обрывок карты леса', async ({ page }) => {
      await openApp(page, lang);
      await seedChapter4(page, lang);
      await seedMissionsDone(page, lang, ['ms:cafe.4']);
      await page.goto('./#/');
      await page.reload();
      await page.goto('./#/loc/cafe');
      const link = page.getByTestId('trial-link').filter({ hasText: 'глава IV' });
      await expect(link).toContainText('глава IV · можно проходить');
      await link.click();
      await expect(page).toHaveURL(/#\/trial\/tr%3Acafe\.4$/);
      await page.getByTestId('trial-start').click();
      const { total } = await playTrial(page, lang, 'cafe');
      expect(total).toBe(15);
      await expect(page.getByTestId('trial-result')).toContainText('Испытание пройдено');
      // В испытании фразы уровня 6 и слова только уровня 6.
      const six = new Set([...wordIdsOf(lang, 'cafe', [6]), ...loadPhraseData(lang, 'cafe').filter((p) => p.level === 6).map((p) => p.id)]);
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log).toHaveLength(15);
      expect(log.every((a) => six.has(a.itemId))).toBe(true);
      expect(log.some((a) => a.itemId.startsWith('ph:'))).toBe(true);
      await expect.poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toContain('4:cafe');
    });

    test('Хранительница леса: страж главы IV проверяет слова на слух', async ({ page }) => {
      await openApp(page, lang);
      await seedChapter4(page, lang);
      await page.goto('./#/');
      await page.reload();
      await page.goto('./#/guardian/4');
      await expect(page.getByTestId('guardian-greeting')).toContainText(GREETING[lang]);
      await expect(page.getByTestId('guardian-listen')).toContainText('8 заданий из 20 — слова на слух');
      await page.getByTestId('guardian-start').click();
      const { total } = await playTrial(page, lang, null, 0, b2(lang));
      expect(total).toBe(20);
      await expect(page.getByTestId('guardian-result')).toContainText('Печать главы IV получена');
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log.filter((a) => a.kind.startsWith('listen'))).toHaveLength(8);
      expect(log.filter((a) => !a.kind.startsWith('grammar-') && !a.kind.startsWith('listen'))).toHaveLength(0);
      await expect.poll(async () => (await readMeta<{ seals: Record<string, number> }>(page, lang, 'journey'))?.seals).toHaveProperty('4');
    });
  });
}
