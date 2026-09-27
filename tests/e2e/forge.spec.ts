import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { conjugate, TENSE_LESSON, type Tense, type VerbData } from '../../src/domain/verbs';
import { DB, EXAM_KEYS, LANGS, openApp, readAnswers, type Lang } from './fixtures';

const verbsOf = (lang: Lang): VerbData[] =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'verbs.json'), 'utf8')).verbs;

/** Отметить уроки грамматики пройденными и перезагрузить. */
async function passLessons(page: Page, lang: Lang, ids: string[]) {
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('grammar', 'readwrite');
          for (const lessonId of ids) tx.objectStore('grammar').put({ lessonId, completedAt: 1, bestScore: 90 });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

function cardIds(page: Page, lang: Lang): Promise<string[]> {
  return page.evaluate(
    (db) =>
      new Promise<string[]>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('cards').objectStore('cards').getAllKeys();
          q.onsuccess = () => resolve(q.result as string[]);
        };
      }),
    DB[lang],
  );
}

/** Сдвинуть срок карточки на сегодня: ошибка возвращается не раньше завтрашнего дня. */
async function makeDue(page: Page, lang: Lang, id: string) {
  await page.evaluate(
    ({ db, id }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const store = r.result.transaction('cards', 'readwrite').objectStore('cards');
          const q = store.get(id);
          q.onsuccess = () => store.put({ ...q.result, due: 0 }).addEventListener('success', () => resolve());
        };
      }),
    { db: DB[lang], id },
  );
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

/** Задание на экране и верная форма по данным контента. */
async function current(page: Page, lang: Lang) {
  const task = page.getByTestId('forge-task');
  const inf = (await task.getAttribute('data-inf'))!;
  const tense = (await task.getAttribute('data-tense')) as Tense;
  const person = Number(await task.getAttribute('data-person'));
  const verb = verbsOf(lang).find((v) => v.inf === inf)!;
  return { inf, tense, person, answer: conjugate(verb, tense, lang)[person] };
}

async function forge(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Форма глагола' }).fill(text);
  await page.getByRole('button', { name: 'Проверить' }).click();
  await page.getByRole('button', { name: /Дальше/ }).click();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('кузница: закрыта до урока спряжения, ошибка становится карточкой и возвращается первой', async ({ page }) => {
      await openApp(page, lang);
      await page.goto('./#/grammar');
      await expect(page.getByTestId('forge-entry')).toContainText('Откроется после первого урока спряжения');
      await page.getByTestId('forge-entry').click();
      await expect(page.getByTestId('forge-locked')).toContainText('Горн холодный');
      await expect(page.getByTestId('forge-start')).toHaveCount(0);

      await passLessons(page, lang, [TENSE_LESSON[lang].presente!, TENSE_LESSON[lang].futuro!]);
      await page.goto('./#/forge');
      const open = page.locator('[data-testid="forge-tenses"] [data-open="true"]');
      await expect(open).toHaveCount(2);
      await page.getByTestId('forge-start').click();
      // Над полем только буквы с ударением: буквы ответа подсказали бы форму.
      expect(await page.getByTestId('forge-run').locator('form button.w-11').allTextContents()).toEqual(EXAM_KEYS[lang]);

      // Первая форма — с ошибкой, остальные девять верно.
      const first = await current(page, lang);
      expect(['presente', 'futuro']).toContain(first.tense);
      await forge(page, 'zzz');
      for (let i = 1; i < 10; i++) {
        await expect(page.getByTestId('forge-progress')).toHaveText(`${i + 1} / 10`);
        const t = await current(page, lang);
        expect(['presente', 'futuro']).toContain(t.tense);
        await forge(page, t.answer);
      }
      await expect(page.getByTestId('forge-result')).toContainText('Верно: 9 из 10');
      await expect(page.getByTestId('forge-misses')).toContainText(first.answer);

      const firstId = `v:${first.inf}.${first.tense}.${first.person + 1}`;
      expect((await cardIds(page, lang)).filter((id) => id.startsWith('v:'))).toEqual([firstId]);
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'forge');
      expect(log).toHaveLength(10);
      expect(log.filter((a) => a.verdict === 'wrong').map((a) => a.itemId)).toEqual([firstId]);

      // Назавтра форма ждёт перековки, но только в кузнице: на главной повторять нечего.
      await makeDue(page, lang, firstId);
      await expect(page.getByText('На сегодня всё повторено')).toBeVisible();

      // В следующей плавке кузнец первой даёт эту форму, теперь её выковываем верно.
      await page.goto('./#/grammar');
      await expect(page.getByTestId('forge-entry')).toContainText('Ждут перековки: 1 форма');
      await page.getByTestId('forge-entry').click();
      await expect(page.getByTestId('forge-due')).toContainText('Ждут перековки: 1 форма');
      await page.getByTestId('forge-start').click();
      const again = await current(page, lang);
      expect(again).toEqual(first);
      await forge(page, again.answer);
      await expect(page.getByTestId('forge-progress')).toHaveText('2 / 10');
    });
  });
}
