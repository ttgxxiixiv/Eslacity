import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { answerGrammar, DB, exact, LANGS, openApp, readAnswers, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

type Question = { q: string; options: string[]; answer: number };
interface Sphinx {
  sphinx: { speech: Record<string, { es: string; ru: string }> };
  word: { exercises: Parameters<typeof answerGrammar>[1]['exercises'] }[];
  hear: { monologue: { who: string; lines: unknown[] }; dispute: unknown[]; questions: Question[] }[];
  wisdom: { title: string; questions: Question[]; register: Parameters<typeof answerGrammar>[1]['exercises'] }[];
}
const load = (lang: Lang) => JSON.parse(readFileSync(join(CONTENT, lang, 'sphinx.json'), 'utf8')) as Sphinx;

/** Имя говорящего загадки слуха: житель или Летописец. */
function speakerName(lang: Lang, who: string): string {
  const chronicler = JSON.parse(readFileSync(join(CONTENT, lang, 'chronicler.json'), 'utf8')) as { id: string; name: string };
  if (who === chronicler.id) return chronicler.name;
  const npcs = JSON.parse(readFileSync(join(CONTENT, lang, 'npcs.json'), 'utf8')).npcs as { id: string; name: string }[];
  return npcs.find((n) => n.id === who)!.name;
}

/** Печать главы V получена, глава V открыта; `sphinx` — запись Врат, если нужна. */
async function seedGates(page: Page, lang: Lang, sphinx?: unknown) {
  await page.evaluate(
    ({ db, sphinx }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['meta'], 'readwrite');
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, openedChapter: 5, celebrated: 5 } });
          if (sphinx) tx.objectStore('meta').put({ key: 'sphinx', value: sphinx });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], sphinx },
  );
  await page.goto('./#/');
  await page.reload();
}

/** Пройти реплики загадки слуха до вопросов. Возвращает число реплик. */
async function listen(page: Page): Promise<number> {
  let n = 0;
  for (; n < 60; n++) {
    const next = page.getByTestId('sphinx-line-next');
    const last = (await next.textContent())?.includes('К вопросам');
    await next.click();
    if (last) return n + 1;
  }
  throw new Error('Реплики не кончились');
}

/** Ответить на задания раунда: первые `wrong` — нарочно неверно. Возвращает число заданий. */
async function answerRound(page: Page, questions: Question[], exercises: Parameters<typeof answerGrammar>[1]['exercises'], wrong = 0) {
  const run = page.getByTestId('trial-run');
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('sphinx-result').count()) return i;
    await expect(run).toBeVisible();
    const bad = i < wrong;
    if (await run.getByTestId('sphinx-question').count()) {
      const text = ((await run.getByTestId('sphinx-question').textContent()) ?? '').trim();
      const q = questions.find((x) => x.q === text);
      if (!q) throw new Error(`Вопрос не найден: ${text}`);
      const pick = bad ? q.options.find((_, k) => k !== q.answer)! : q.options[q.answer];
      await run.locator('button').filter({ hasText: exact(pick) }).click();
      await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
    } else {
      await answerGrammar(page, { exercises }, bad);
    }
    // У плашки медали тоже есть aria-live: отзыв ищется по кнопке «Дальше».
    const fb = (await page.locator('[aria-live]').filter({ has: page.getByRole('button', { name: /дальше/i }) }).textContent()) ?? '';
    if (!bad && /неверно/i.test(fb)) throw new Error(`Правильный ответ не засчитан: ${fb}`);
    await page.getByRole('button', { name: /дальше/i }).click();
  }
  throw new Error('Раунд не закончился');
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    const sx = load(lang);

    test('без печати главы V Врат нет', async ({ page }) => {
      await openApp(page, lang, '/journey-map');
      await expect(page.getByRole('heading', { name: 'Карта странствий' }).or(page.getByText('Карта странствий')).first()).toBeVisible();
      await expect(page.getByTestId('gates-panel')).toHaveCount(0);
      await page.goto('./#/sphinx');
      await expect(page.getByTestId('sphinx-closed')).toBeVisible();
    });

    test('Сфинкс: три загадки подряд, реплики с переводом, тайная медаль за первый приход', async ({ page }) => {
      test.setTimeout(240_000);
      await openApp(page, lang);
      await seedGates(page, lang);
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('gates-status')).toContainText('три загадки');
      await page.getByTestId('gates-go').click();

      const greeting = page.getByTestId('sphinx-greeting');
      await expect(greeting).toContainText(sx.sphinx.speech.greeting.es);
      await expect(page.getByTestId('sphinx-greeting-ru')).toHaveCount(0);
      await greeting.click();
      await expect(page.getByTestId('sphinx-greeting-ru')).toContainText(sx.sphinx.speech.greeting.ru);
      await expect(page.getByTestId('sphinx-hearts')).toHaveAttribute('data-hearts', '3');
      await expect
        .poll(async () => (await readMeta<{ medals: { secrets: Record<string, number> } }>(page, lang, 'motivation'))?.medals.secrets ?? {})
        .toHaveProperty('sphinx');

      // Загадка слуха, первый набор: монолог и спор голосами, текст скрыт.
      await page.getByTestId('sphinx-start').click();
      await expect(page.getByTestId('sphinx-round-line')).toContainText(sx.sphinx.speech.hear.es);
      await page.getByTestId('sphinx-begin').click();
      const hear = sx.hear[0];
      await expect(page.getByTestId('sphinx-speaker')).toContainText(speakerName(lang, hear.monologue.who));
      await expect(page.getByTestId('sphinx-line-text')).toHaveCount(0);
      expect(await listen(page)).toBe(hear.monologue.lines.length + hear.dispute.length);
      expect(await answerRound(page, hear.questions, [])).toBe(8);
      await expect(page.getByTestId('sphinx-result')).toContainText('Загадка разгадана');
      await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.pass.es);

      // Загадка слова: десять заданий с вводом.
      await page.getByTestId('sphinx-next').click();
      await expect(page.getByTestId('sphinx-round-line')).toContainText(sx.sphinx.speech.word.es);
      await page.getByTestId('sphinx-begin').click();
      expect(await answerRound(page, [], sx.word[0].exercises)).toBe(10);
      await expect(page.getByTestId('sphinx-hearts')).toHaveAttribute('data-hearts', '3');

      // Загадка мудрости: текст, вопросы (текст можно перечитать), ответ в двух тонах.
      await page.getByTestId('sphinx-next').click();
      await page.getByTestId('sphinx-begin').click();
      await expect(page.getByTestId('sphinx-wisdom-text')).toContainText(sx.wisdom[0].title);
      await page.getByTestId('sphinx-questions').click();
      await page.getByTestId('sphinx-text').click();
      await expect(page.getByTestId('sphinx-text-sheet')).toContainText(sx.wisdom[0].title);
      await page.getByRole('button', { name: 'К заданию' }).click();
      expect(await answerRound(page, sx.wisdom[0].questions, sx.wisdom[0].register)).toBe(7);
      await expect(page.getByTestId('sphinx-result')).toContainText('Все загадки разгаданы');
      await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.victory.es);

      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'sphinx');
      expect(log).toHaveLength(25);
      await expect.poll(async () => (await readMeta<{ done?: number }>(page, lang, 'sphinx'))?.done).toBeGreaterThan(0);
      await page.getByTestId('sphinx-back').click();
      await expect(page.getByTestId('sphinx-state')).toContainText('Врата открыты');
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('gates-status')).toContainText('Врата открыты');
    });

    test('проигранный раунд стоит сердце и идёт по другому набору, без сердец — ожидание три дня', async ({ page }) => {
      await openApp(page, lang);
      // Первое сердце уже потеряно на загадке слуха: следующая попытка идёт по второму набору.
      await seedGates(page, lang, { visited: 1, hearts: 2, rounds: {}, attempts: { hear: 1 } });
      await page.goto('./#/sphinx');
      await expect(page.getByTestId('sphinx-greeting')).toContainText(sx.sphinx.speech.again.es);
      await expect(page.getByTestId('sphinx-hearts')).toHaveAttribute('data-hearts', '2');
      await page.getByTestId('sphinx-start').click();
      await page.getByTestId('sphinx-begin').click();
      await expect(page.getByTestId('sphinx-speaker')).toContainText(speakerName(lang, sx.hear[1].monologue.who));
      await listen(page);
      await answerRound(page, sx.hear[1].questions, [], 2);
      await expect(page.getByTestId('sphinx-result')).toContainText('Сфинкс не принял ответ');
      await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.fail.es);
      await expect(page.getByTestId('sphinx-hearts')).toHaveAttribute('data-hearts', '1');

      // Третий набор, последнее сердце.
      await page.getByTestId('sphinx-next').click();
      await page.getByTestId('sphinx-begin').click();
      await expect(page.getByTestId('sphinx-speaker')).toContainText(speakerName(lang, sx.hear[2].monologue.who));
      await listen(page);
      await answerRound(page, sx.hear[2].questions, [], 8);
      await expect(page.getByTestId('sphinx-verdict')).toContainText(sx.sphinx.speech.rest.es);
      await expect(page.getByTestId('sphinx-next')).toHaveCount(0);
      await page.getByTestId('sphinx-back').click();
      await expect(page.getByTestId('sphinx-state')).toContainText('через 3 дн');
      await expect(page.getByTestId('sphinx-start')).toHaveCount(0);
      await expect(page.getByTestId('sphinx-greeting')).toContainText(sx.sphinx.speech.waiting.es);
      const rec = await readMeta<{ hearts: number; waitUntil: number }>(page, lang, 'sphinx');
      expect(rec?.hearts).toBe(0);
      expect(rec!.waitUntil - Date.now()).toBeGreaterThan(71 * 3_600_000);

      // Три дня прошли: сердца снова полные, набор — снова первый (четвёртая попытка).
      await seedGates(page, lang, { ...rec, waitUntil: Date.now() - 1000 });
      await page.goto('./#/sphinx');
      await expect(page.getByTestId('sphinx-hearts')).toHaveAttribute('data-hearts', '3');
      await page.getByTestId('sphinx-start').click();
      await page.getByTestId('sphinx-begin').click();
      await expect(page.getByTestId('sphinx-speaker')).toContainText(speakerName(lang, sx.hear[0].monologue.who));
    });
  });
}
