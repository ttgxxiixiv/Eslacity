import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, seedDueCards, wordIdsOf, type Lang } from './fixtures';

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

    test('карта странствий: вход с главной и из профиля, обрывок и что не хватает', async ({ page }) => {
      await openApp(page, lang);
      await page.getByTestId('map-button').click();
      await expect(page).toHaveURL(/#\/journey-map$/);
      await expect(page.getByTestId('fragments-count')).toHaveText('0 / 20');
      await expect(page.getByTestId('hero')).toBeVisible();

      await page.goto('./#/');
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      await page.goto('./#/profile');
      await expect(page.getByTestId('profile-map')).toContainText('Глава I · 1 / 20 обрывков');
      await page.getByTestId('profile-map').click();
      await expect(page.getByTestId('fragments-count')).toHaveText('1 / 20');
      const map = page.getByTestId('land-map');
      await expect(map.locator('[data-got="1"]')).toHaveCount(1);

      await map.getByRole('button', { name: /^Кафе: обрывок получен/ }).click();
      await expect(page.getByTestId('map-details')).toContainText('Обрывок получен');
      const market = wordIdsOf(lang, 'market', [1, 2]).length;
      await map.getByRole('button', { name: /^Рынок: обрывка нет/ }).click();
      await expect(page.getByTestId('map-details')).toContainText(`место ещё не открыто, осталось выучить ${market} слов`);
      await page.getByRole('button', { name: /Перейти: Рынок/ }).click();
      await expect(page).toHaveURL(/#\/loc\/market$/);

      // Печать и соседние главы на дороге.
      await page.goto('./#/journey-map');
      await page.getByRole('button', { name: /Печать главы/ }).click();
      await expect(page.getByTestId('map-details')).toContainText('осталось 31 из 31');
      await page.getByRole('button', { name: /Глава II: Горный перевал/ }).click();
      await expect(page.getByText('Глава ещё закрыта.')).toBeVisible();
    });

    test('строка «Путь» на главной: глава, обрывки и ближайший обрывок', async ({ page }) => {
      await openApp(page, lang);
      const line = page.getByTestId('journey-line');
      const cafe = wordIdsOf(lang, 'cafe', [1, 2]);
      await expect(line).toContainText('Глава I · 0 / 20 обрывков');
      await expect(line).toContainText(`Кафе: осталось ${cafe.length} слов`);

      // Кафе выучено наполовину — ближайшим остаётся кафе, с меньшим остатком.
      await seedDueCards(page, lang, cafe.slice(0, 10));
      await expect(line).toContainText(`Кафе: осталось ${cafe.length - 10} слов`);

      // Кафе выучено целиком: обрывок есть, дальше рынок, который ещё закрыт.
      await seedDueCards(page, lang, cafe);
      await expect(line).toContainText('Глава I · 1 / 20 обрывков');
      await expect(line).toContainText(`Рынок: откройте место, ${wordIdsOf(lang, 'market', [1, 2]).length} слов`);
      await line.click();
      await expect(page).toHaveURL(/#\/journey-map$/);
    });

    test('карта главы I собрана: сцена перехода один раз и титул Странник', async ({ page }) => {
      await openApp(page, lang);
      await expect(page.getByTestId('chapter-scene')).toHaveCount(0);
      await page.goto('./#/profile');
      await expect(page.getByTestId('hero-title')).toHaveText('Путник');
      await page.goto('./#/');
      const places = ['cafe', 'market', 'supermarket', 'restaurant', 'home', 'park', 'clothes', 'pharmacy', 'school', 'post',
        'bank', 'barber', 'gym', 'station', 'beach', 'office', 'hotel', 'hospital', 'airport', 'police'];
      await seedDueCards(page, lang, places.flatMap((p) => wordIdsOf(lang, p, [1, 2])));
      await put(page, lang, 'grammar', lessonIds(lang, 'a1').map((lessonId) => ({ lessonId, completedAt: 1, bestScore: 90 })));

      const scene = page.getByTestId('chapter-scene');
      await expect(scene).toBeVisible();
      await expect(page.getByTestId('scene-title')).toContainText('Странник', { timeout: 8000 });
      await expect(page.getByTestId('scene-title')).toContainText('открыта глава II, Горный перевал');
      await page.getByRole('button', { name: 'В путь' }).click();
      await expect(scene).toHaveCount(0);
      expect((await readMeta<{ celebrated: number; openedChapter: number }>(page, lang, 'journey'))).toMatchObject({ celebrated: 1, openedChapter: 2 });

      // Второй раз не показывается, титул виден в профиле и в подписи щитка уровня.
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(scene).toHaveCount(0);
      await expect(page.getByTestId('level-badge')).toHaveAttribute('aria-label', /^Странник, уровень/);
      await page.goto('./#/profile');
      await expect(page.getByTestId('hero-title')).toHaveText('Странник');
      await page.goto('./#/grammar');
      await expect(page.getByTestId('district-lock')).toHaveCount(3);
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
