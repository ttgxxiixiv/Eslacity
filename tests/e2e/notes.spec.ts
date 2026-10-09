import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
interface NoteData { id: string; location: string; chapter: number; title: string; task: string; sample: string; must: { label: string; hint: string }[] }
const noteOf = (lang: Lang, place: string) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'letters.json'), 'utf8')).notes as NoteData[]).find((n) => n.location === place)!;

/** Записка без «завтра»: первый пункт must не найден, остальные есть. */
const WITHOUT_TOMORROW: Record<Lang, string> = {
  es: '¡Hola, Lola! Gracias por la invitación. Voy a ir a tu fiesta a las ocho. Un beso.',
  it: "Ciao, Giulia! Grazie dell'invito. Vengo alla tua festa alle otto con una torta. Un bacio.",
};

/** Открыта глава `chapter`, у кафе здание. */
async function seed(page: Page, lang: Lang, chapter: number) {
  await page.evaluate(
    ({ db, chapter }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['buildings', 'meta'], 'readwrite');
          tx.objectStore('buildings').put({ locationId: 'cafe', level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: chapter, celebrated: chapter } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], chapter },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('записка жителю: проверка ключевых слов, подсказка, исправление, образец после отправки, опыт и дневник', async ({ page }) => {
      const note = noteOf(lang, 'cafe');
      await openApp(page, lang);
      await seed(page, lang, 2);
      await page.goto('./#/loc/cafe');
      const link = page.getByTestId('note-link');
      await expect(link).toContainText(note.title);
      await expect(link).toContainText('новое');
      await expect(page.getByTestId('letter-link')).toHaveCount(0);
      await link.click();

      await expect(page.getByTestId('note-task')).toHaveText(note.task);
      const check = page.getByRole('button', { name: 'Проверить' });
      await page.getByTestId('note-text').fill('Hola, Lola.');
      await expect(page.getByTestId('note-words')).toContainText('нужно хотя бы 10');
      await expect(check).toBeDisabled();

      // Без «завтра»: первый пункт не найден, видна подсказка, образца ещё нет.
      await page.getByTestId('note-text').fill(WITHOUT_TOMORROW[lang]);
      await check.click();
      const items = page.getByTestId('note-must');
      await expect(items).toHaveCount(note.must.length);
      await expect(items.first()).toHaveAttribute('data-ok', 'false');
      await expect(items.first()).toContainText(note.must[0].hint);
      await expect(items.nth(1)).toHaveAttribute('data-ok', 'true');
      await expect(page.getByTestId('note-check')).toContainText(`${note.must.length - 1} из ${note.must.length}`);
      await expect(page.getByTestId('note-sample')).toHaveCount(0);

      // Исправить: текст остаётся в поле, дописываем «завтра».
      await page.getByRole('button', { name: 'Исправить записку' }).click();
      await expect(page.getByTestId('note-text')).toHaveValue(WITHOUT_TOMORROW[lang]);
      const fixed = note.sample;
      await page.getByTestId('note-text').fill(fixed);
      await check.click();
      await expect(page.getByTestId('note-check')).toContainText(`${note.must.length} из ${note.must.length}`);
      await page.getByRole('button', { name: 'Отправить', exact: true }).click();

      await expect(page.getByTestId('note-sample')).toContainText(note.sample.split('\n')[0]);
      await expect(page.getByTestId('note-done')).toContainText('+20 опыта');
      await expect.poll(async () => (await readMeta<{ entries: unknown[] }>(page, lang, 'letters'))?.entries.length).toBe(1);
      const data = await readMeta<{ entries: { letterId: string; checks: number[]; text: string }[] }>(page, lang, 'letters');
      expect(data?.entries[0]).toMatchObject({ letterId: note.id, checks: note.must.map((_, i) => i), text: fixed });

      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('note-link')).toContainText('✓ в дневнике');

      // Вторая записка, неполная: в дневник, без опыта.
      await page.getByTestId('note-link').click();
      await page.getByTestId('note-text').fill(WITHOUT_TOMORROW[lang]);
      await page.getByRole('button', { name: 'Проверить' }).click();
      await page.getByRole('button', { name: 'Отправить как есть' }).click();
      await expect(page.getByTestId('note-done')).toContainText(`${note.must.length - 1} из ${note.must.length}`);
      await expect(page.getByTestId('note-done')).not.toContainText('опыта');

      await page.goto('./#/letters');
      const entries = page.getByTestId('diary-entry');
      await expect(entries).toHaveCount(2);
      await expect(entries.first()).toContainText(note.title);
      await expect(entries.first()).toContainText(`записка ${note.must.length - 1} из ${note.must.length}`);
    });

    test('в главе I записки нет', async ({ page }) => {
      await openApp(page, lang);
      await seed(page, lang, 1);
      await page.goto('./#/loc/cafe');
      await expect(page.getByTestId('trial-link').first()).toBeVisible();
      await expect(page.getByTestId('note-link')).toHaveCount(0);
      await page.goto(`./#/note/${encodeURIComponent('nt:cafe')}`);
      await expect(page.getByText('Эта записка откроется в главе II.')).toBeVisible();
    });
  });
}
