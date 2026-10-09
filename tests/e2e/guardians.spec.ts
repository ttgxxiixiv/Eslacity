import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DB, LANGS, loadLesson, openApp, playTrial, readAnswers, readMeta, scrollIdsOf, seedDueCards, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Упражнения всех уроков района A1: страж главы I берёт задания из них. */
const a1 = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'grammar', 'a1'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => loadLesson(lang, 'a1', f.replace('.json', '')).exercises);

const GUARDIAN = { es: 'Hola, viajero.', it: 'Ciao, viaggiatore.' } as const;
const MID = { es: 'Hablas bien.', it: 'Parli bene.' } as const;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('страж главы I: у печати на карте, пускает после свитка, победа даёт печать и «Испытателя»', async ({ page }) => {
      await openApp(page, lang, '/journey-map');
      const scroll = scrollIdsOf(lang, 1);
      const panel = page.getByTestId('guardian-panel');
      await expect(page.getByTestId('guardian-sprite')).toBeVisible();
      await expect(panel).toContainText('Привратник');
      await expect(panel).toContainText(GUARDIAN[lang]);
      await expect(page.getByTestId('guardian-status')).toContainText(`Страж пустит, когда выучен свиток земли: осталось ${scroll.length} слов.`);
      await expect(page.getByTestId('guardian-go')).toHaveCount(0);

      // Свиток и слова кафе выучены: страж пускает.
      await page.goto('./#/');
      await seedDueCards(page, lang, [...scroll, ...wordIdsOf(lang, 'cafe', [1, 2])]);
      await page.goto('./#/journey-map');
      await page.getByTestId('guardian-go').click();
      await expect(page).toHaveURL(/#\/guardian\/1$/);
      await expect(page.getByTestId('guardian-greeting')).toContainText(GUARDIAN[lang]);
      await expect(page.getByTestId('guardian-lessons')).toContainText('Уроки района пройдены: 0 из 31.');
      await page.getByTestId('guardian-start').click();
      await expect(page.getByTestId('trial-progress')).toHaveText('1 / 20');
      const { total, typed } = await playTrial(page, lang, null, 0, a1(lang));
      expect(total).toBe(20);
      expect(typed).toBeGreaterThan(0);
      const result = page.getByTestId('guardian-result');
      await expect(result).toContainText('Печать главы I получена');
      await expect(result).toContainText('Верно: 20 из 20 (100%)');
      await expect(page.getByTestId('guardian-reward')).toContainText('+100 🪙');
      await expect.poll(async () => (await readMeta<{ seals: Record<string, number> }>(page, lang, 'journey'))?.seals).toHaveProperty('1');
      // В журнале и грамматика, и слова — под режимом испытания.
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log).toHaveLength(20);
      expect(log.some((a) => a.kind.startsWith('grammar-'))).toBe(true);
      expect(log.some((a) => !a.kind.startsWith('grammar-'))).toBe(true);

      await page.getByRole('button', { name: 'На карту странствий' }).click();
      await expect(page.getByTestId('guardian-status')).toContainText('Страж пропустил героя: печать главы получена.');
      await expect(page.getByTestId('guardian-sprite')).toHaveCount(0);
      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=trials]')).toContainText('1 / 5 испытаний до камня');
    });

    test('схватка: удар, приём, отражение и щиты, реплика на середине, исход по порогу 75%', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, [...scrollIdsOf(lang, 1), ...wordIdsOf(lang, 'cafe', [1, 2])]);
      await page.goto('./#/guardian/1');
      await expect(page.getByTestId('guardian-duel')).toContainText('Щитов 5');
      await page.getByTestId('guardian-start').click();
      const duel = page.getByTestId('duel');
      await expect(duel).toHaveAttribute('data-strength', '1.000');
      await expect(duel).toHaveAttribute('data-shields', '5');
      // Две ошибки: страж отражает, два щита разбиты, сила не тронута.
      await playTrial(page, lang, null, 2, a1(lang), 2);
      await expect(duel).toHaveAttribute('data-shields', '3');
      await expect(duel).toHaveAttribute('data-strength', '1.000');
      await expect(page.getByTestId('duel-move')).toHaveText('Страж отразил');
      // Три верных подряд: третий — приём, всего 4 удара из 15.
      await playTrial(page, lang, null, 0, a1(lang), 3);
      await expect(page.getByTestId('duel-move')).toHaveText('Приём!');
      await expect(duel).toHaveAttribute('data-strength', (1 - 4 / 15).toFixed(3));
      await expect(page.getByTestId('duel-mid')).toHaveCount(0);
      // После десятого ответа — реплика стража середины схватки.
      await playTrial(page, lang, null, 0, a1(lang), 5);
      await expect(page.getByTestId('duel-mid')).toContainText(MID[lang]);
      await playTrial(page, lang, null, 0, a1(lang));
      const result = page.getByTestId('guardian-result');
      await expect(result).toContainText('Печать главы I получена');
      await expect(result).toContainText('Верно: 18 из 20 (90%)');
    });

    test('страж не пропустил: печати нет, следующая попытка через сутки', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, [...scrollIdsOf(lang, 1), ...wordIdsOf(lang, 'cafe', [1, 2])]);
      await page.goto('./#/guardian/1');
      await page.getByTestId('guardian-start').click();
      // Шесть ошибок из двадцати: 70%, меньше порога 75%.
      await playTrial(page, lang, null, 6, a1(lang));
      const result = page.getByTestId('guardian-result');
      await expect(result).toContainText('Страж не пропустил');
      await expect(result).toContainText('Верно: 14 из 20 (70%)');
      await expect(page.getByTestId('guardian-reward')).toHaveCount(0);
      expect((await readMeta<{ seals: Record<string, number> }>(page, lang, 'journey'))?.seals ?? {}).toEqual({});
      await page.getByRole('button', { name: 'На карту странствий' }).click();
      await expect(page.getByTestId('guardian-status')).toContainText('Страж ждёт вас снова через 24 ч.');
      await page.goto('./#/guardian/1');
      await expect(page.getByTestId('guardian-state')).toContainText('Следующая попытка через 24 ч.');
      // Сутки прошли — можно снова.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'trials', value: { 'gd:1': { attempts: 1, best: 0.7, failedAt: Date.now() - 86_400_001 } } });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await page.reload();
      await expect(page.getByTestId('guardian-start')).toBeVisible();
    });
  });
}
