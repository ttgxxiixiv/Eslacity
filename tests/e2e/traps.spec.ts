import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { Word } from '../../src/content/schema';
import { openApp, type Lang } from './fixtures';

/**
 * Ловушки для русскоговорящих (задача 21.4): пометка `ruTrap` в «Моих словах», строка «Ловушка русского» в итоге
 * неверного ответа и поручение Летописца «Ловушки» раз в неделю на всех курсах.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const COURSES = ['es', 'it', 'en', 'tr', 'pt'] as const;
type Course = (typeof COURSES)[number];
const DBS: Record<Course, string> = { es: 'eslacity', it: 'eslacity-it', en: 'eslacity-en', tr: 'eslacity-tr', pt: 'eslacity-pt' };
const DAY = 86_400_000;

function traps(lang: Course): Word[] {
  const dirs = ['words', 'scrolls'].map((d) => join(CONTENT, lang, d));
  return dirs.flatMap((d) => readdirSync(d).flatMap((f) => (JSON.parse(readFileSync(join(d, f), 'utf8')).words as Word[]).filter((w) => w.ruTrap)));
}

/** Выученные карточки, повторены вчера, до срока ещё далеко. */
async function seedKnown(page: Page, lang: Course, ids: string[]) {
  await page.evaluate(
    ({ db, ids, last }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('cards', 'readwrite');
          for (const id of ids) {
            tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 20, reps: 3, due: last + 20 * 86_400_000, lapses: 0, learnedAt: last, lastReviewedAt: last, stability: 20, difficulty: 5, state: 2 });
          }
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DBS[lang], ids, last: Date.now() - DAY },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

/** День последних «Ловушек» из `meta.errands`. */
function trapsDay(page: Page, lang: Course): Promise<number | undefined> {
  return page.evaluate(
    (db) =>
      new Promise<number | undefined>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('meta').objectStore('meta').get('errands');
          q.onsuccess = () => resolve(q.result?.value?.traps);
        };
      }),
    DBS[lang],
  );
}

for (const lang of COURSES) {
  test(`${lang}: ловушки русского — пометка, итог ошибки и поручение раз в неделю`, async ({ page }) => {
    const words = traps(lang).slice(0, 4);
    const byEs = new Map(words.map((w) => [w.es, w]));
    const byRu = new Map(words.map((w) => [w.ru, w]));
    await openApp(page, lang as Lang);
    await seedKnown(page, lang, words.map((w) => w.id));

    // «Мои слова»: пометка у каждой ловушки.
    await page.goto('./#/words');
    await expect(page.getByTestId('ru-trap')).toHaveCount(words.length);
    await expect(page.getByTestId('ru-trap').first()).toContainText('Ловушка русского');

    await page.goto('./#/errands');
    const card = page.getByTestId('traps-card');
    await expect(card).toContainText('Ловушки');
    await expect(card).toContainText(`${words.length} слова`);
    await card.click();

    const label = page.locator('.text-sm.font-medium.text-stone-500').first();
    const prompt = page.locator('.text-3xl.font-bold').first();
    const kinds = new Set<string>();
    let trapNote = '';
    for (let i = 0; i < 30 && !(await page.getByTestId('traps-thanks').count()); i++) {
      const kind = (await label.textContent({ timeout: 3000 }).catch(() => null))?.trim();
      if (!kind) continue;
      const shown = ((await prompt.textContent()) ?? '').trim();
      if (kind === 'Выберите перевод') {
        kinds.add('choice');
        await page.locator('button.min-h-14').filter({ hasText: byEs.get(shown)!.ru }).first().click();
      } else if (kind.startsWith('Напишите') && kind !== 'Напишите, что услышали') {
        kinds.add('type');
        // Первый ввод — нарочно мимо: в итоге строка о ловушке этого слова.
        await page.locator('input').fill(trapNote ? byRu.get(shown)!.es : 'zzzz');
        await page.locator('button[type=submit]').click();
        if (!trapNote) {
          trapNote = (await page.locator('[aria-live]').first().textContent()) ?? '';
          expect(trapNote).toContain(`Ловушка русского: ${byRu.get(shown)!.ruTrap}`);
        }
      } else {
        throw new Error(`Неожиданное задание: «${kind}»`);
      }
      await page.getByRole('button', { name: /дальше/i }).click();
    }
    expect([...kinds].sort()).toEqual(['choice', 'type']);
    await expect(page.getByTestId('traps-thanks')).toContainText('+18 🪙');
    expect(await trapsDay(page, lang)).toBeGreaterThan(0);

    // До следующей недели «Ловушек» нет.
    await page.goto('./#/errands');
    await expect(page.getByTestId('errands-empty').or(page.getByTestId('errand-card').first())).toBeVisible();
    await expect(page.getByTestId('traps-card')).toHaveCount(0);
    await page.goto('./#/traps');
    await expect(page.getByTestId('traps-none')).toBeVisible();
  });
}
