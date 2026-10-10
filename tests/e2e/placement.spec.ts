import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadLesson, openApp, playTrial, readAnswers, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Упражнения всех районов: задания правил в тесте берутся из любого из них. */
const allExercises = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'grammar')).flatMap((d) =>
    readdirSync(join(CONTENT, lang, 'grammar', d))
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => loadLesson(lang, d, f.replace('.json', '')).exercises),
  );

/** Карточки базы языка. */
const readCards = (page: Page, lang: Lang) =>
  page.evaluate(
    ({ db }) =>
      new Promise<{ wordId: string; stability: number; state: number }[]>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const q = r.result.transaction('cards').objectStore('cards').getAll();
          q.onsuccess = () => resolve(q.result);
        };
      }),
    { db: DB[lang] },
  );

const readBuildings = (page: Page, lang: Lang) =>
  page.evaluate(
    ({ db }) =>
      new Promise<{ locationId: string; level: number }[]>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const q = r.result.transaction('buildings').objectStore('buildings').getAll();
          q.onsuccess = () => resolve(q.result);
        };
      }),
    { db: DB[lang] },
  );

type Journey = { fragments: Record<string, number>; seals: Record<string, number>; openedChapter: number };

for (const lang of LANGS) {
  test.describe(lang, () => {
    const exercises = allExercises(lang);

    test('при первом запуске тест предлагается, его можно пропустить; он есть в настройках', async ({ page }) => {
      await openApp(page, lang);
      await expect(page.getByTestId('placement-offer')).toBeVisible();
      await page.getByTestId('placement-skip-home').click();
      await expect(page.getByTestId('placement-offer')).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('placement-offer')).toHaveCount(0);
      await page.goto('./#/settings/learning');
      await page.getByTestId('settings-placement').click();
      await expect(page.getByTestId('placement-intro')).toBeVisible();
      // Отказ уже записан: второй кнопки «пропустить» нет.
      await expect(page.getByTestId('placement-skip')).toHaveCount(0);
    });

    test('две главы засчитаны: обрывки, печати, здания 4-го уровня, названные слова в повторении, открыта глава III', async ({ page }) => {
      test.setTimeout(180_000);
      await openApp(page, lang);
      await page.getByTestId('placement-go').click();
      await page.getByTestId('placement-start').click();
      expect((await playTrial(page, lang, null, 0, exercises)).total).toBe(10);
      await expect(page.getByTestId('placement-between')).toContainText('Глава I засчитана');
      await page.getByTestId('placement-next').click();
      expect((await playTrial(page, lang, null, 0, exercises)).total).toBe(10);
      await expect(page.getByTestId('placement-between')).toContainText('Глава II засчитана');
      await page.getByTestId('placement-stop').click();
      await expect(page.getByTestId('placement-passed')).toHaveText('Засчитано глав: 2');

      await expect.poll(async () => (await readMeta<Journey>(page, lang, 'journey'))?.openedChapter).toBe(3);
      const j = (await readMeta<Journey>(page, lang, 'journey'))!;
      expect(Object.keys(j.fragments).filter((k) => k.startsWith('1:'))).toHaveLength(20);
      expect(Object.keys(j.fragments).filter((k) => k.startsWith('2:'))).toHaveLength(20);
      expect(Object.keys(j.seals).sort()).toEqual(['1', '2']);
      const buildings = await readBuildings(page, lang);
      expect(buildings).toHaveLength(20);
      expect(buildings.every((b) => b.level >= 4)).toBe(true);
      // 12 названных слов — карточки на повторении со стабильностью 10–20 дней.
      const cards = await readCards(page, lang);
      expect(cards).toHaveLength(12);
      expect(cards.every((c) => c.state === 2 && c.stability >= 10 && c.stability <= 20)).toBe(true);
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'placement');
      expect(log).toHaveLength(20);

      await page.getByTestId('placement-home').click();
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('placement-offer')).toHaveCount(0);
      await expect(page.getByTestId('journey-line')).toContainText('Глава III');
    });

    test('первая глава не засчитана: путь с начала, ничего не выдано', async ({ page }) => {
      await openApp(page, lang);
      await page.getByTestId('placement-go').click();
      await page.getByTestId('placement-start').click();
      await playTrial(page, lang, null, 3, exercises);
      await expect(page.getByTestId('placement-passed')).toHaveText('Путь начинается с первой главы');
      await expect.poll(async () => (await readMeta<{ done?: number; passed?: number }>(page, lang, 'placement'))?.passed).toBe(0);
      expect(await readCards(page, lang)).toHaveLength(0);
      expect(Object.keys((await readMeta<Journey>(page, lang, 'journey'))?.fragments ?? {})).toHaveLength(0);
      await page.getByTestId('placement-home').click();
      await expect(page.getByTestId('placement-offer')).toHaveCount(0);
    });

    test('все пять глав: печать главы V не выдаётся, Врат на карте нет', async ({ page }) => {
      test.setTimeout(360_000);
      await openApp(page, lang);
      await page.goto('./#/placement');
      await page.getByTestId('placement-start').click();
      for (let c = 1; c <= 5; c++) {
        expect((await playTrial(page, lang, null, 0, exercises)).total).toBe(10);
        if (c < 5) await page.getByTestId('placement-next').click();
      }
      await expect(page.getByTestId('placement-passed')).toHaveText('Засчитано глав: 5');
      await expect(page.getByTestId('placement-result')).toContainText('Печать главы V охраняет Хозяин Эха');
      await expect.poll(async () => Object.keys((await readMeta<Journey>(page, lang, 'journey'))?.seals ?? {}).sort()).toEqual(['1', '2', '3', '4']);
      const j = (await readMeta<Journey>(page, lang, 'journey'))!;
      expect(j.openedChapter).toBe(5);
      expect(Object.keys(j.fragments).filter((k) => k.startsWith('5:'))).toHaveLength(20);
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('guardian-panel')).toBeVisible();
      await expect(page.getByTestId('gates-panel')).toHaveCount(0);
    });
  });
}
