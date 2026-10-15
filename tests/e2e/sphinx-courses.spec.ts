import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { answerGrammar, exact, openCourse } from './fixtures';

/**
 * Курсы без города (английский писался закрытым, задача 17.8; турецкий — 18.8): Сфинкс и Хранилище открываются
 * напрямую. Три загадки первым набором проходятся без ошибок, потом сцена Хранилища и Эликсир. Остальные наборы
 * проверяет `src/content/sphinx.test.ts`.
 */
const COURSES = ['en', 'tr'] as const;
type Course = (typeof COURSES)[number];
const DBS: Record<Course, string> = { en: 'eslacity-en', tr: 'eslacity-tr' };
type Question = { q: string; options: string[]; answer: number };
type Exercises = Parameters<typeof answerGrammar>[1]['exercises'];
type SphinxFile = {
  sphinx: { speech: Record<string, { es: string }>; vault: { before: { es: string }[]; after: { es: string }[] } };
  word: { exercises: Exercises }[];
  hear: { monologue: { lines: unknown[] }; dispute: unknown[]; questions: Question[] }[];
  wisdom: { title: string; questions: Question[]; register: Exercises }[];
};
const load = (lang: Course) => JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'sphinx.json'), 'utf8')) as SphinxFile;

/** Печать главы V получена, глава V открыта; `sphinx` — запись Врат, если нужна. */
async function seedGates(page: Page, db: string, sphinx?: unknown) {
  // Сначала приложение должно запуститься: при старте оно само записывает путь в базу. Главная закрытого курса
  // уводит в пролог, которого у него ещё нет, поэтому ждём экран настроек.
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await page.evaluate(
    ({ db, sphinx }) =>
      new Promise<void>((resolve, reject) => {
        // База создаётся при запуске приложения: ждём, пока в ней появится таблица meta.
        const attempt = () => {
          const r = indexedDB.open(db);
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            if (!r.result.objectStoreNames.contains('meta')) {
              r.result.close();
              setTimeout(attempt, 100);
              return;
            }
            const tx = r.result.transaction(['meta'], 'readwrite');
            tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, openedChapter: 5, celebrated: 5 } });
            if (sphinx) tx.objectStore('meta').put({ key: 'sphinx', value: sphinx });
            tx.oncomplete = () => resolve();
          };
        };
        attempt();
      }),
    { db, sphinx },
  );
  await page.reload();
}

async function listen(page: Page): Promise<number> {
  for (let n = 0; n < 60; n++) {
    const next = page.getByTestId('sphinx-line-next');
    const last = (await next.textContent())?.includes('К вопросам');
    await next.click();
    if (last) return n + 1;
  }
  throw new Error('Реплики не кончились');
}

async function answerRound(page: Page, questions: Question[], exercises: Exercises): Promise<number> {
  const run = page.getByTestId('trial-run');
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('sphinx-result').count()) return i;
    await expect(run).toBeVisible();
    if (await run.getByTestId('sphinx-question').count()) {
      const text = ((await run.getByTestId('sphinx-question').textContent()) ?? '').trim();
      const q = questions.find((x) => x.q === text);
      if (!q) throw new Error(`Вопрос не найден: ${text}`);
      await run.locator('button').filter({ hasText: exact(q.options[q.answer]) }).click();
      await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
    } else {
      await answerGrammar(page, { exercises });
    }
    if ((await page.locator('[data-verdict]').getAttribute('data-verdict')) === 'wrong') throw new Error(`Правильный ответ не засчитан: задание ${i + 1}`);
    await page.getByRole('button', { name: /дальше/i }).click();
  }
  throw new Error('Раунд не закончился');
}

for (const lang of COURSES) test(`${lang}: Сфинкс — три загадки без ошибок, потом Хранилище и Эликсир`, async ({ page }) => {
  test.setTimeout(240_000);
  const sx = load(lang);
  await openCourse(page, lang);
  await seedGates(page, DBS[lang]);
  await page.goto('./#/sphinx');
  await expect(page.getByTestId('sphinx-greeting')).toContainText(sx.sphinx.speech.greeting.es);

  await page.getByTestId('sphinx-start').click();
  await expect(page.getByTestId('sphinx-round-line')).toContainText(sx.sphinx.speech.hear.es);
  await page.getByTestId('sphinx-begin').click();
  expect(await listen(page)).toBe(sx.hear[0].monologue.lines.length + sx.hear[0].dispute.length);
  expect(await answerRound(page, sx.hear[0].questions, [])).toBe(8);
  await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.pass.es);

  await page.getByTestId('sphinx-next').click();
  await expect(page.getByTestId('sphinx-round-line')).toContainText(sx.sphinx.speech.word.es);
  await page.getByTestId('sphinx-begin').click();
  expect(await answerRound(page, [], sx.word[0].exercises)).toBe(10);

  await page.getByTestId('sphinx-next').click();
  await page.getByTestId('sphinx-begin').click();
  await expect(page.getByTestId('sphinx-wisdom-text')).toContainText(sx.wisdom[0].title);
  await page.getByTestId('sphinx-questions').click();
  expect(await answerRound(page, sx.wisdom[0].questions, sx.wisdom[0].register)).toBe(7);
  await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.victory.es);

  await page.getByTestId('vault-go').click();
  const v = sx.sphinx.vault;
  await expect(page.getByTestId('vault-line')).toContainText(v.before[0].es);
  for (let i = 1; i < v.before.length; i++) {
    await page.getByTestId('vault-next').click();
    await expect(page.getByTestId('vault-line')).toContainText(v.before[i].es);
  }
  await page.getByTestId('vault-next').click();
  await page.getByTestId('drink').click();
  await expect(page.getByTestId('vault-line')).toContainText(v.after[0].es);
});
