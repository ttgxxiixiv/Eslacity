import { expect, test } from '@playwright/test';
import { DB, LANGS, loadPhraseData, openApp, playTrial, readAnswers, readMeta, seedDueCards, seedMissionsDone, wordIdsOf, type Lang } from './fixtures';


/** Выученные фразы уровней 1–2 места: чтобы в испытание попали и фразы. */
const phraseIds = (lang: Lang, place: string) => loadPhraseData(lang, place).filter((p) => p.level <= 2).map((p) => p.id);

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('испытание кафе: откроется после слов, пройдено — обрывок карты, медаль «Испытатель»', async ({ page }) => {
      await openApp(page, lang, '/loc/cafe');
      const cafe = wordIdsOf(lang, 'cafe', [1, 2]);
      const link = page.getByTestId('trial-link');
      await expect(link).toContainText(`глава I · осталось ${cafe.length} слов`);
      await link.click();
      await expect(page.getByTestId('trial-state')).toContainText(`Сначала выучите слова главы: осталось ${cafe.length}.`);
      await expect(page.getByTestId('trial-start')).toHaveCount(0);

      // Слова и фразы выучены, миссия пройдена: обрывок ждёт только испытание.
      await page.goto('./#/');
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedDueCards(page, lang, [...cafe, ...phraseIds(lang, 'cafe')]);
      await page.goto('./#/loc/cafe');
      await expect(link).toContainText('глава I · можно проходить');
      await link.click();
      await page.getByTestId('trial-start').click();
      await expect(page.getByTestId('trial-progress')).toHaveText('1 / 15');
      const { total, typed } = await playTrial(page, lang, 'cafe');
      expect(total).toBe(15);
      expect(typed).toBeGreaterThanOrEqual(8);
      const result = page.getByTestId('trial-result');
      await expect(result).toContainText('Испытание пройдено');
      await expect(result).toContainText('Верно: 15 из 15 (100%)');
      await expect(page.getByTestId('trial-reward')).toContainText('+40 🪙');
      await expect.poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toEqual(['1:cafe']);
      expect((await readMeta<Record<string, { done?: number }>>(page, lang, 'trials'))?.['tr:cafe.1']?.done).toBeGreaterThan(0);
      // Ответы в журнале под своим режимом, карточки повторения не тронуты.
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log).toHaveLength(15);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(link).toContainText('глава I · ✓ пройдено');

      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=trials]')).toContainText('1 / 5 испытаний до камня');
    });

    test('испытание не пройдено: обрывка нет, следующая попытка через сутки', async ({ page }) => {
      await openApp(page, lang);
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      await page.goto('./#/trial/tr%3Acafe.1');
      await page.getByTestId('trial-start').click();
      // Четыре ошибки из пятнадцати: 73%, меньше порога.
      await playTrial(page, lang, 'cafe', 4);
      const result = page.getByTestId('trial-result');
      await expect(result).toContainText('Испытание не пройдено');
      await expect(result).toContainText('Верно: 11 из 15 (73%)');
      await expect(page.getByTestId('trial-reward')).toHaveCount(0);
      expect(Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toEqual([]);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('trial-link')).toContainText('глава I · снова через 24 ч');
      await page.getByTestId('trial-link').click();
      await expect(page.getByTestId('trial-state')).toContainText('Следующая попытка через 24 ч');
      await expect(page.getByTestId('trial-start')).toHaveCount(0);

      // Сутки прошли: попытка снова доступна.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'trials', value: { 'tr:cafe.1': { attempts: 1, best: 0.7, failedAt: Date.now() - 86_400_001 } } });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await page.reload();
      await expect(page.getByTestId('trial-start')).toBeVisible();
    });
  });
}
