import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
/** id уроков района: папка a2 → a2.<файл>. */
const lessonIds = (lang: Lang, folder: string) =>
  readdirSync(join(CONTENT, lang, 'grammar', folder)).map((f) => `${folder}.${f.replace(/\.json$/, '')}`).sort();

/** Записать строки в таблицу базы языка (или удалить ключ meta) и перезагрузить. */
async function put(page: Page, lang: Lang, table: string, rows: object[], dropMeta?: string) {
  await page.evaluate(
    ({ db, table, rows, dropMeta }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction([table, 'meta'], 'readwrite');
          for (const row of rows) tx.objectStore(table).put(row);
          if (dropMeta) tx.objectStore('meta').delete(dropMeta);
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], table, rows, dropMeta },
  );
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('глава II закрыта, пока не собрана карта главы I', async ({ page }) => {
      await openApp(page, lang);
      expect((await readMeta<{ openedChapter: number }>(page, lang, 'journey'))?.openedChapter).toBe(1);

      await page.goto('./#/grammar');
      await expect(page.getByTestId('district-lock')).toHaveCount(4);
      await expect(page.getByTestId('district-lock').first()).toContainText('Откроется в главе II');

      await page.goto(`./#/grammar/${lessonIds(lang, 'a2')[0]}`);
      await expect(page.getByTestId('district-lock')).toContainText('откроется в главе II');

      // Кафе прокачано до уровня 3 уже после обновления: уровень всё равно ждёт главу II.
      await put(page, lang, 'buildings', [{ locationId: 'cafe', level: 3, lastCollectedAt: Date.now() }]);
      await page.goto('./#/loc/cafe');
      const locks = page.getByTestId('chapter-lock');
      await expect(locks.nth(0)).toContainText('Откроется в главе II: сначала соберите карту главы I.');
      await expect(locks.nth(1)).toContainText('Откроется в главе II: сначала соберите карту главы I.');
      await expect(locks.nth(2)).toContainText('Откроется в главе III: сначала соберите карту главы II.');
      await expect(page.getByRole('heading', { name: 'Уровень 2' })).toBeVisible();
    });

    test('прогресс до обновления с пройденными уроками A2: ничего не закрылось', async ({ page }) => {
      await openApp(page, lang);
      const done = [...lessonIds(lang, 'a1'), ...lessonIds(lang, 'a2').slice(0, 5)];
      // Как у игрока версии 2.6.0: уроки пройдены, в пути нет открытой главы.
      await put(page, lang, 'grammar', done.map((lessonId) => ({ lessonId, completedAt: 1, bestScore: 90 })), 'journey');
      expect((await readMeta<{ openedChapter: number }>(page, lang, 'journey'))?.openedChapter).toBe(2);

      await page.goto('./#/grammar');
      await expect(page.getByTestId('district-lock')).toHaveCount(3);
      await expect(page.getByRole('button', { name: /Район A2/ })).toBeVisible();
      await page.goto(`./#/grammar/${lessonIds(lang, 'a2')[0]}`);
      await expect(page.getByRole('button', { name: /к упражнениям/i })).toBeVisible();
      // Следующий урок грамматики на главной — из A2, а не «всё пройдено».
      await page.goto('./#/');
      await expect(page.getByText('A2', { exact: true })).toBeVisible();
    });
  });
}
