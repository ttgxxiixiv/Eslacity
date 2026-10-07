import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, PLACES, readMeta, seedDueCards, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

interface ThreadScene {
  id: string;
  lines: { es: string }[];
  questions: { q: string; options: string[]; answer: number }[];
}

/** Записать обрывки главы I (`n` мест, время получения `ts`) и перезагрузить. */
async function seedFragments(page: Page, lang: Lang, n: number, ts: number, chapter = 1) {
  const fragments = Object.fromEntries(PLACES.slice(0, n).map((p) => [`${chapter}:${p}`, ts]));
  // Глава 2 открыта, когда собрана карта главы 1.
  if (chapter > 1) for (const p of PLACES) fragments[`1:${p}`] = ts;
  await page.evaluate(
    ({ db, value }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'journey', value });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], value: { fragments, seals: chapter > 1 ? { '1': ts } : {}, openedChapter: chapter, celebrated: chapter - 1 } },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

async function playScene(page: Page, sc: ThreadScene) {
  for (const l of sc.lines) {
    await expect(page.getByTestId('scene-current')).toContainText(l.es);
    await page.getByTestId('scene-next').click();
  }
  for (const q of sc.questions) {
    await expect(page.getByTestId('scene-question')).toHaveText(q.q);
    await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
    await page.getByRole('button', { name: /дальше|итог/i }).click();
  }
  await page.getByRole('button', { name: 'Готово' }).click();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    const thread = JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', 'thread.json'), 'utf8')) as { scenes: ThreadScene[]; notes: Record<string, { es: string }[]> };
    const scene = (id: string) => thread.scenes.find((s) => s.id === id)!;

    test('нить главы: пролог главы, середина на 10 обрывках, записка за день с обрывком', async ({ page }) => {
      await openApp(page, lang);
      // У новичка без слов кнопки нет: главная открывается по мере игры.
      await expect(page.getByTestId('chronicle-button')).toHaveCount(0);
      await seedDueCards(page, lang, [await firstWord(lang)]);
      const button = page.getByTestId('chronicle-button');
      await expect(button).toContainText('1');
      await button.click();
      await expect(page).toHaveURL(/#\/chronicle$/);
      await expect(page.getByTestId('thread-note')).toHaveCount(0);
      await expect(page.getByTestId('thread-next')).toContainText('когда соберёте 10 обрывков карты (сейчас 0)');
      await page.getByTestId('thread-due').click();
      await expect(page.getByRole('heading', { name: /Летопись: Глава I\. Начало главы/ })).toBeVisible();
      await playScene(page, scene('th:1.open'));
      await expect(page).toHaveURL(/#\/chronicle$/);
      await expect(page.getByTestId('thread-due')).toHaveCount(0);
      await expect(page.getByTestId('thread-seen')).toHaveText(['Глава I. Начало главы']);
      expect(Object.keys((await readMeta<{ seen: Record<string, number> }>(page, lang, 'thread'))?.seen ?? {})).toEqual(['th:1.open']);
      await page.goto('./');
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('chronicle-button')).toHaveCount(0);

      // Десять обрывков, один из них сегодня: середина главы и записка.
      await seedFragments(page, lang, 10, Date.now());
      await expect(page.getByTestId('chronicle-button')).toContainText('2');
      await page.getByTestId('chronicle-button').click();
      const note = page.getByTestId('thread-note');
      await expect(note).toContainText('Летописец оставил записку: сегодня 10 обрывков карты');
      expect(thread.notes['1'].map((n) => n.es)).toContain(await page.getByTestId('thread-note-text').innerText());
      await page.getByTestId('thread-note-read').click();
      await expect(page.getByTestId('thread-note-read')).toHaveCount(0);
      expect((await readMeta<{ note?: string }>(page, lang, 'thread'))?.note).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await expect(page.getByTestId('thread-next')).toContainText('когда соберёте 20 обрывков карты (сейчас 10)');
      await page.getByTestId('thread-due').click();
      await playScene(page, scene('th:1.half'));
      await expect(page.getByTestId('thread-seen')).toHaveText(['Глава I. Середина пути', 'Глава I. Начало главы']);
      await page.goto('./');
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('chronicle-button')).toHaveCount(0);
    });

    test('обрывки не сегодня — записки нет; Летопись открывается с карты странствий', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, [await firstWord(lang)]);
      await seedFragments(page, lang, 12, Date.now() - 3 * 86_400_000);
      // Начало и середина главы ждут, записки нет.
      await expect(page.getByTestId('chronicle-button')).toContainText('2');
      await page.goto('./#/journey-map');
      await page.getByTestId('chronicle-link').click();
      await expect(page.getByTestId('thread-due')).toHaveCount(2);
      await expect(page.getByTestId('thread-note')).toHaveCount(0);
    });

    test('глава II: её начало и середина открываются по обрывкам главы II', async ({ page }) => {
      await openApp(page, lang);
      await seedDueCards(page, lang, [await firstWord(lang)]);
      await seedFragments(page, lang, 10, Date.now() - 3 * 86_400_000, 2);
      await page.goto('./#/chronicle');
      await expect(page.getByTestId('thread-due')).toHaveCount(5);
      await expect(page.getByTestId('thread-due').last()).toContainText('Глава II. Середина пути');
      await expect(page.getByTestId('thread-next')).toContainText('Следующая запись главы II — когда соберёте 20 обрывков карты (сейчас 10)');
      await page.getByTestId('thread-due').last().click();
      await playScene(page, scene('th:2.half'));
      await expect(page.getByTestId('thread-seen')).toHaveText(['Глава II. Середина пути']);
    });
  });
}

/** Первое слово кафе: одна карточка открывает кнопки главной. */
async function firstWord(lang: Lang): Promise<string> {
  const data = JSON.parse(readFileSync(join(CONTENT, lang, 'words', 'cafe.json'), 'utf8')) as { words: { id: string }[] };
  return data.words[0].id;
}
