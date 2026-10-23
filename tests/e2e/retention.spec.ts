import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

/**
 * Запоминаемость (задача 21.2): режим FSRS в разделе «Обучение», пересчёт сроков выученных карточек и подсказка
 * по сверке прогноза с ответами.
 */
const DAY = 86_400_000;

/** Выученные карточки (FSRS, повторены два дня назад, стабильность 6 дней) и сверка: 150 повторов, все вспомнены при прогнозе 90%. */
async function seed(page: Page, lang: Lang, ids: string[]) {
  await page.evaluate(
    ({ db, ids, last }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'meta'], 'readwrite');
          for (const id of ids) {
            tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 6, reps: 3, due: 0, lapses: 0, learnedAt: last, lastReviewedAt: last, stability: 6, difficulty: 5, state: 2 });
          }
          tx.objectStore('meta').put({ key: 'calibration', value: Array.from({ length: 150 }, () => [900, 1]) });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids, last: Date.now() - 2 * DAY },
  );
}

async function dues(page: Page, lang: Lang): Promise<number[]> {
  return page.evaluate(
    (db) =>
      new Promise<number[]>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('cards').objectStore('cards').getAll();
          q.onsuccess = () => resolve((q.result as { due: number }[]).map((c) => c.due));
        };
      }),
    DB[lang],
  );
}

for (const lang of LANGS) {
  test(`${lang}: запоминаемость — режим пересчитывает сроки, сверка подсказывает «реже»`, async ({ page }) => {
    await openApp(page, lang);
    const ids = ['cafe.te', 'cafe.cafe', 'cafe.leche'];
    await seed(page, lang, ids);
    await page.reload();
    await page.goto('./#/settings/learning');
    const card = page.getByTestId('retention');
    await expect(card.getByTestId('retention-normal')).toHaveAttribute('aria-pressed', 'true');

    // Сверка: вспомнено 100% при прогнозе 90% — подсказка повторять реже.
    const hint = card.getByTestId('retention-hint');
    await expect(hint).toHaveAttribute('data-kind', 'better');
    await expect(hint).toContainText('За последние 150 повторов вы вспомнили 100% слов, а по расчёту выходило 90%');

    // «Надёжнее»: сроки всех трёх карточек пересчитаны от последнего повтора.
    await card.getByTestId('retention-firm').click();
    await expect(card.getByTestId('retention-moved')).toContainText('Сроки пересчитаны: 3 карточки');
    await expect.poll(async () => (await readMeta<{ retention: string }>(page, lang, 'settings'))?.retention).toBe('firm');
    await expect.poll(async () => Math.min(...(await dues(page, lang)))).toBeGreaterThan(0);
    const firm = Math.max(...(await dues(page, lang)));

    // Подсказка предлагает на ступень реже — «Обычно»; дальше «Повторять реже»: сроки дальше, чем у «Надёжнее».
    await expect(hint.getByTestId('retention-suggest')).toHaveText('Выбрать «Обычно»');
    await hint.getByTestId('retention-suggest').click();
    await expect(card.getByTestId('retention-normal')).toHaveAttribute('aria-pressed', 'true');
    await expect(hint.getByTestId('retention-suggest')).toHaveText('Выбрать «Повторять реже»');
    await hint.getByTestId('retention-suggest').click();
    await expect(card.getByTestId('retention-light')).toHaveAttribute('aria-pressed', 'true');
    await expect(hint.getByTestId('retention-suggest')).toHaveCount(0);
    await expect.poll(async () => Math.min(...(await dues(page, lang)))).toBeGreaterThan(firm);
    await page.reload();
    await expect(page.getByTestId('retention-light')).toHaveAttribute('aria-pressed', 'true');
  });
}
