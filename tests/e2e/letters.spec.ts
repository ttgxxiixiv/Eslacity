import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
interface LetterData { id: string; location: string; title: string; task: string; sample: string; checks: { label: string }[] }
const letterOf = (lang: Lang, place: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'letters.json'), 'utf8')).letters as LetterData[]).find((l) => l.location === place)!;

/** Открыта глава `chapter`, у банка здание. */
async function seed(page: Page, lang: Lang, chapter: number) {
  await page.evaluate(
    ({ db, chapter }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['buildings', 'meta'], 'readwrite');
          tx.objectStore('buildings').put({ locationId: 'bank', level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], chapter },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

/** Письмо героя: 45 слов своими словами (здесь — вариации образца). */
const myLetter = (sample: string) => `${sample}\n${sample.split(/\s+/).slice(0, 8).join(' ')}`;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('письмо с образцом: просьба жителя, письмо, образец и чек-лист, опыт и дневник', async ({ page }) => {
      const letter = letterOf(lang, 'bank');
      await openApp(page, lang);
      await seed(page, lang, 5);
      await page.goto('./#/loc/bank');
      const link = page.getByTestId('letter-link');
      await expect(link).toContainText(letter.title);
      await expect(link).toContainText('новое');
      await link.click();

      await expect(page.getByTestId('letter-task')).toHaveText(letter.task);
      const send = page.getByRole('button', { name: 'Сравнить с образцом' });
      // Короткое письмо не отправить.
      await page.getByTestId('letter-text').fill('Hola, hola.');
      await expect(page.getByTestId('letter-words')).toContainText('2 слова · нужно 40–80');
      await expect(send).toBeDisabled();
      // Кнопки с ударениями вставляют букву в поле.
      await page.getByTestId('letter-text').fill('');
      await page.getByRole('button', { name: lang === 'es' ? 'ñ' : 'è', exact: true }).click();
      await expect(page.getByTestId('letter-text')).toHaveValue(lang === 'es' ? 'ñ' : 'è');
      // Курсор после буквы ставится в следующем кадре: дождаться его, иначе он попадёт внутрь следующего fill.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const mine = myLetter(letter.sample);
      await page.getByTestId('letter-text').fill(mine);
      await expect(send).toBeEnabled();
      await send.click();

      await expect(page.getByTestId('letter-sample')).toContainText(letter.sample.split('\n')[0]);
      await expect(page.getByTestId('letter-mine')).toContainText(mine.split('\n')[0]);
      const boxes = page.getByTestId('letter-checks').getByRole('checkbox');
      await expect(boxes).toHaveCount(letter.checks.length);
      await boxes.nth(0).click();
      await boxes.nth(2).click();
      await expect(boxes.nth(0)).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: 'Записать в дневник' }).click();
      await expect(page.getByTestId('letter-done')).toContainText(`2 из ${letter.checks.length}`);
      await expect(page.getByTestId('letter-done')).toContainText('+40 опыта');
      // Запись в базу асинхронная: ждём её.
      await expect.poll(async () => (await readMeta<{ entries: unknown[] }>(page, lang, 'letters'))?.entries.length).toBe(1);
      const data = await readMeta<{ entries: { letterId: string; checks: number[]; text: string }[] }>(page, lang, 'letters');
      expect(data?.entries[0]).toMatchObject({ letterId: letter.id, checks: [0, 2], text: mine });

      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('letter-link')).toContainText('✓ в дневнике');

      // Второе письмо по той же просьбе: в дневник, но без опыта.
      await page.getByTestId('letter-link').click();
      await page.getByTestId('letter-text').fill(mine);
      await page.getByRole('button', { name: 'Сравнить с образцом' }).click();
      await page.getByRole('button', { name: 'Записать в дневник' }).click();
      await expect(page.getByTestId('letter-done')).not.toContainText('опыта');

      await page.goto('./#/profile');
      await expect(page.getByTestId('profile-letters')).toContainText('2');
      await page.getByTestId('profile-letters').click();
      const entries = page.getByTestId('diary-entry');
      await expect(entries).toHaveCount(2);
      await expect(entries.first()).toContainText(letter.title);
      await expect(entries.first()).toContainText(`чек-лист 0 из ${letter.checks.length}`);
      await entries.last().click();
      await expect(entries.last()).toContainText(mine.split('\n')[1]);
    });

    test('до главы V письма нет', async ({ page }) => {
      await openApp(page, lang);
      await seed(page, lang, 4);
      await page.goto('./#/loc/bank');
      await expect(page.getByTestId('trial-link').first()).toBeVisible();
      await expect(page.getByTestId('letter-link')).toHaveCount(0);
      await page.goto(`./#/letter/${encodeURIComponent('lt:bank')}`);
      await expect(page.getByText('Это письмо откроется в главе V.')).toBeVisible();
    });
  });
}
