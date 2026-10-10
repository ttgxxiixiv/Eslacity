import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, seedMissionsDone, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Entry = { id: string; chapter: number; from: string; es: string };
const diary = (lang: Lang) => (JSON.parse(readFileSync(join(CONTENT, lang, 'diary.json'), 'utf8')).entries as Entry[]).filter((e) => e.chapter === 1);

/** Записать значение в meta базы языка. */
async function putMeta(page: Page, lang: Lang, key: string, value: unknown) {
  await page.evaluate(
    ({ db, key, value }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key, value });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], key, value },
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('дневник путника: записи открывают разговоры, миссии, Летопись и слухи; полная глава — тайная медаль', async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, lang);
      const entries = diary(lang);
      const scenes = entries.filter((e) => e.from.startsWith('sc:'));
      const last = scenes.at(-1)!;

      await page.goto('./#/profile');
      await expect(page.getByTestId('profile-diary')).toContainText(`0 / ${entries.length}`);
      await page.getByTestId('profile-diary').click();
      await expect(page).toHaveURL(/#\/diary$/);
      await expect(page.getByTestId('diary-progress')).toContainText(`Записано 0 из ${entries.length}`);
      await expect(page.locator('[data-testid=diary-entry][data-open=false]')).toHaveCount(entries.length);
      // Следующие главы закрыты.
      await expect(page.getByTestId('diary-tab').nth(1)).toBeDisabled();

      // Всё, кроме последнего разговора: миссии мест (у начавших до дневника), сцена Летописца и слух.
      await seedMissionsDone(page, lang, scenes.slice(0, -1).map((e) => e.from.replace('sc:', 'ms:')));
      await putMeta(page, lang, 'thread', { seen: Object.fromEntries(entries.filter((e) => e.from.startsWith('th:')).map((e) => [e.from, 1])) });
      await putMeta(page, lang, 'rumors', { got: entries.filter((e) => e.from.startsWith('rm:')).map((e) => e.from) });
      await page.reload();
      await expect(page.getByTestId('diary-progress')).toContainText(`Записано ${entries.length - 1} из ${entries.length}`);
      const open = page.locator(`[data-testid=diary-entry][data-id="${entries[0].id}"]`);
      await expect(open).toHaveAttribute('data-open', 'true');
      await expect(open.getByTestId('diary-quote')).toHaveText(entries[0].es);

      // Последний разговор дослушан — запись открыта, глава собрана, тайная медаль.
      await page.goto(`./#/scene/${encodeURIComponent(last.from)}`);
      for (let i = 0; i < 40 && !((await page.getByTestId('scene-next').textContent()) ?? '').includes('К вопросам'); i++) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      await expect(page.getByTestId('scene-question')).toBeVisible();
      expect(await readMeta(page, lang, 'diary')).toEqual({ scenes: [last.from] });
      await page.goto('./#/diary');
      await expect(page.getByTestId('diary-progress')).toContainText(`Записано ${entries.length} из ${entries.length} · 100%`);
      await expect(page.getByTestId('diary-progress')).toContainText('Страница главы заполнена');
      const motivation = await readMeta<{ medals: { secrets: Record<string, number> } }>(page, lang, 'motivation');
      expect(motivation?.medals.secrets.diary).toEqual(expect.any(Number));
    });
  });
}
