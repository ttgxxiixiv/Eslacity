import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, PLACES, readMeta, seedDueCards, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

interface BookData {
  words: { id: string; es: string; ru: string; forms: string[] }[];
  books: { id: string; title: { es: string }; paragraphs: { es: string; ru: string }[]; questions: { q: string; options: string[]; answer: number }[] }[];
}

async function seedFragments(page: Page, lang: Lang, n: number, chapter = 1) {
  const fragments = Object.fromEntries(PLACES.slice(0, n).map((p) => [`${chapter}:${p}`, 1]));
  // Глава открыта, когда собраны карты прошлых глав.
  for (let c = 1; c < chapter; c++) for (const p of PLACES) fragments[`${c}:${p}`] = 1;
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
    { db: DB[lang], value: { fragments, seals: {}, openedChapter: chapter, celebrated: chapter - 1 } },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

const cardIds = (page: Page, lang: Lang) =>
  page.evaluate(
    (db) =>
      new Promise<string[]>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const q = r.result.transaction('cards').objectStore('cards').getAllKeys();
          q.onsuccess = () => resolve(q.result as string[]);
        };
      }),
    DB[lang],
  );

/** Книги Летописца (задача 12.4): открываются по обрывкам главы, слово из текста — в мои слова, вопросы и опыт. */
for (const lang of LANGS) {
  test.describe(lang, () => {
    const data = JSON.parse(readFileSync(join(CONTENT, lang, 'books', '1.json'), 'utf8')) as BookData;
    const book = data.books[0];
    const text = book.paragraphs.map((p) => p.es).join(' ');
    const word = data.words.find((w) => w.forms.some((f) => text.includes(f)))!;
    const form = word.forms.find((f) => text.includes(f))!;

    test('первая книга главы: чтение, слово в мои слова, вопросы и опыт', async ({ page }) => {
      await openApp(page, lang);
      const first = JSON.parse(readFileSync(join(CONTENT, lang, 'words', 'cafe.json'), 'utf8')).words[0].id as string;
      await seedDueCards(page, lang, [first]);
      await seedFragments(page, lang, 5);
      await expect(page.getByTestId('chronicle-button')).toContainText('2');
      await page.getByTestId('chronicle-button').click();
      const books = page.getByTestId('books');
      await expect(books.getByTestId('book-open')).toHaveCount(1);
      await expect(books.getByTestId('book-locked')).toHaveCount(3);
      await expect(books.getByTestId('book-locked').first()).toContainText('откроется на 10 обрывках главы (сейчас 5)');
      await books.getByTestId('book-open').click();

      await expect(page.getByTestId('book-title')).toHaveText(book.title.es);
      await page.getByTestId('book-translate').click();
      await expect(page.getByTestId('book-text')).toContainText(book.paragraphs[0].ru);
      await page.getByTestId('book-text').getByRole('button', { name: form, exact: true }).first().click();
      await expect(page.getByTestId('book-word')).toContainText(`${word.es} — ${word.ru}`);
      await page.getByTestId('book-add-word').click();
      await expect(page.getByTestId('book-word-mine')).toBeVisible();
      await expect.poll(() => cardIds(page, lang)).toContain(word.id);

      await page.getByTestId('book-quiz').click();
      for (const q of book.questions) {
        await expect(page.getByTestId('scene-question')).toHaveText(q.q);
        await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
        await page.getByRole('button', { name: /дальше|итог/i }).click();
      }
      await expect(page.getByTestId('scene-result')).toContainText(`Понято: ${book.questions.length} из ${book.questions.length}`);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('book-done')).toContainText('+30 опыта');
      await expect.poll(async () => (await readMeta<{ read: Record<string, { score: number }> }>(page, lang, 'books'))?.read[book.id]?.score).toBe(5);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('book-open')).toContainText('понято 5 из 5');

      // Слово книги — среди моих слов, его находит обычный загрузчик слов.
      await page.goto('./#/words');
      await expect(page.getByText(word.es, { exact: true })).toBeVisible();
    });

    for (const chapter of [2, 3, 4, 5]) {
      test(`книга главы ${chapter}: открывается на 5 обрывках главы, вопросы проходятся`, async ({ page }) => {
        const own = JSON.parse(readFileSync(join(CONTENT, lang, 'books', `${chapter}.json`), 'utf8')) as BookData;
        const b = own.books[0];
        await openApp(page, lang);
        await seedFragments(page, lang, 5, chapter);
        await page.goto('./#/book/' + encodeURIComponent(b.id));
        await expect(page.getByTestId('book-title')).toHaveText(b.title.es);
        await page.getByTestId('book-quiz').click();
        for (const q of b.questions) {
          await expect(page.getByTestId('scene-question')).toHaveText(q.q);
          await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
          await page.getByRole('button', { name: /дальше|итог/i }).click();
        }
        await page.getByRole('button', { name: 'Готово' }).click();
        await expect(page.getByTestId('book-done')).toContainText('+30 опыта');
      });
    }

    test('закрытая книга не открывается по адресу', async ({ page }) => {
      await openApp(page, lang);
      await seedFragments(page, lang, 5);
      await page.goto('./#/book/' + encodeURIComponent('book:1.2'));
      await expect(page.getByTestId('book-closed')).toContainText('когда у вас будет 10 обрывков карты главы I');
    });
  });
}
