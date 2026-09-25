import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export type Lang = 'es' | 'it';
export const LANGS: Lang[] = ['es', 'it'];

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
/** Имя базы IndexedDB для языка: у испанского прежнее имя. */
export const DB: Record<Lang, string> = { es: 'eslacity', it: 'eslacity-it' };
/** Наречие в заголовках заданий: «Как сказать по-испански?». */
const ADVERB: Record<Lang, string> = { es: 'по-испански', it: 'по-итальянски' };

interface Word {
  id: string;
  es: string;
  ru: string;
  example: { es: string; ru: string };
}

/** Все слова языка: чтобы ответить на задание по тому, что показано на экране. */
export function loadWords(lang: Lang) {
  const dir = join(CONTENT, lang, 'words');
  const words: Word[] = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).words);
  return {
    byRu: new Map(words.map((w) => [w.ru, w])),
    byEs: new Map(words.map((w) => [w.es, w])),
    byExRu: new Map(words.map((w) => [w.example.ru, w])),
  };
}

/** id слов места на указанных уровнях. */
export function wordIdsOf(lang: Lang, location: string, levels: number[]): string[] {
  const data = JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${location}.json`), 'utf8')) as { words: { id: string; level: number }[] };
  return data.words.filter((w) => levels.includes(w.level)).map((w) => w.id);
}

/** Прочитать запись из таблицы meta базы языка. */
export function readMeta<T>(page: Page, lang: Lang, key: string): Promise<T | undefined> {
  return page.evaluate(
    ({ db, k }) =>
      new Promise<T | undefined>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('meta').objectStore('meta').get(k);
          q.onsuccess = () => resolve(q.result?.value);
        };
      }),
    { db: DB[lang], k: key },
  );
}

type Exercise =
  | { kind: 'choose'; prompt: string; options: string[]; answer: number }
  | { kind: 'gap'; sentence: string; options: string[]; answer: number }
  | { kind: 'truefalse'; statement: string; answer: boolean };

export function loadLesson(lang: Lang, district: string, file: string): { id: string; exercises: Exercise[] } {
  return JSON.parse(readFileSync(join(CONTENT, lang, 'grammar', district, `${file}.json`), 'utf8'));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (s: string) => new RegExp(`^${esc(s)}$`);
const squash = (s: string) => s.replace(/\s+/g, '');

/**
 * Открыть приложение на нужном языке. Озвучка подменяется: в headless-браузере голосов нет,
 * а сказанный текст нужен, чтобы отвечать на задания на слух.
 */
export async function openApp(page: Page, lang: Lang, path = '') {
  await page.addInitScript((l) => {
    // Язык ставится один раз: дальше его может переключить сам тест через настройки.
    if (!localStorage.getItem('eslacity.e2e')) {
      localStorage.setItem('eslacity.lang', l);
      localStorage.setItem('eslacity.e2e', '1');
    }
    (window as unknown as { __said: string[] }).__said = [];
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      (window as unknown as { __said: string[] }).__said.push(u.text);
    };
  }, lang);
  await page.goto('./');
  await expect(page.getByTestId('continue')).toBeVisible();
  if (path) await page.goto(`./#${path}`);
}

/** Записать в базу языка карточки, которые пора повторить, и перезагрузить. */
export async function seedDueCards(page: Page, lang: Lang, wordIds: string[]) {
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('cards', 'readwrite');
          for (const id of ids) {
            tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 1, reps: 1, due: 0, lapses: 0, learnedAt: 0, lastReviewedAt: 0 });
          }
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids: wordIds },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

/** Записать общий опыт героя и перезагрузить. */
export async function seedXp(page: Page, lang: Lang, xp: number) {
  await page.evaluate(
    ({ db, value }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'xpTotal', value });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], value: xp },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

export interface LoggedAnswer {
  itemId: string;
  kind: string;
  verdict: string;
  mode: string;
  ms: number;
}

/** Прочитать журнал ответов из базы языка. */
export function readAnswers(page: Page, lang: Lang): Promise<LoggedAnswer[]> {
  return page.evaluate(
    (db) =>
      new Promise<LoggedAnswer[]>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('answers').objectStore('answers').getAll();
          q.onsuccess = () => resolve(q.result);
        };
      }),
    DB[lang],
  );
}

export interface PlayResult {
  kinds: Record<string, number>;
  verdicts: Record<string, number>;
}

/**
 * Пройти урок слов или повторение, отвечая правильно на каждое задание.
 * Итальянский ввод набирается с типографским апострофом и пробелом после него, как на телефоне.
 */
export async function playWords(page: Page, lang: Lang, done: RegExp): Promise<PlayResult> {
  const { byRu, byEs, byExRu } = loadWords(lang);
  const kinds: Record<string, number> = {};
  const verdicts: Record<string, number> = {};
  const label = page.locator('.text-sm.font-medium.text-stone-500').first();
  // Поздравление с уровнем тоже крупный жирный текст: его исключаем.
  const prompt = page.locator('.text-3xl.font-bold:not([role=status] *), .text-2xl.font-bold:not([role=status] *)').first();
  const options = page.locator('button.min-h-14');
  const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said.at(-1) ?? '');

  for (let i = 0; i < 120; i++) {
    if (await page.getByText(done).count()) return { kinds, verdicts };
    const kind = (await label.textContent({ timeout: 3000 }).catch(() => null))?.trim();
    if (!kind) continue;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    const shown = kind === 'Соедините пары' ? '' : ((await prompt.textContent({ timeout: 3000 }).catch(() => '')) ?? '').trim();

    if (kind === 'Новое слово') {
      await page.getByRole('button', { name: /понятно/i }).click();
      continue;
    } else if (kind === 'Выберите перевод') {
      await options.filter({ hasText: exact(byEs.get(shown)!.ru) }).first().click();
    } else if (kind === `Как сказать ${ADVERB[lang]}?`) {
      await options.filter({ hasText: exact(byRu.get(shown)!.es) }).first().click();
    } else if (kind === 'Что вы услышали?') {
      await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
      await options.filter({ hasText: exact(byEs.get(await said())!.ru) }).first().click();
    } else if (kind === 'Соберите слово') {
      const w = byRu.get(shown)!;
      const m = w.es.match(/^(l'|el |la |los |las |il |lo |i |gli |le )(.*)$/);
      const [art, core] = m ? [m[1].trim(), m[2]] : [null, w.es];
      if (art) await page.locator('button.h-12.flex-1').filter({ hasText: exact(art) }).click();
      for (const ch of core) {
        await page.locator('button.min-w-12:not([disabled])').filter({ hasText: exact(ch) }).first().click();
      }
      await page.getByRole('button', { name: 'Проверить' }).click();
    } else if (kind === 'Соберите фразу') {
      const tokens = byExRu.get(shown)!.example.es.replace(/[¿¡?!.,;:"«»()…—–]/g, ' ').split(/\s+/).filter(Boolean);
      tokens[0] = tokens[0][0].toLowerCase() + tokens[0].slice(1);
      for (const t of tokens) {
        await page.locator('.flex-wrap.justify-center button:not([disabled])').filter({ hasText: exact(t) }).first().click();
      }
      await page.getByRole('button', { name: 'Проверить' }).click();
    } else if (kind === `Напишите ${ADVERB[lang]}` || kind === 'Напишите, что услышали') {
      if (kind !== 'Напишите, что услышали') {
        await page.locator('input').fill(byRu.get(shown)!.es.replace("'", '’ '));
      } else {
        await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
        await page.locator('input').fill(await said());
      }
      await page.locator('button[type=submit]').click();
    } else if (kind === 'Соедините пары') {
      const left = page.locator('.grid-cols-2 > div:first-child > button');
      for (const ru of await left.allTextContents()) {
        await left.filter({ hasText: exact(ru) }).click();
        await page.locator('.grid-cols-2 > div:last-child > button').filter({ hasText: exact(byRu.get(ru)!.es) }).click();
      }
    } else {
      throw new Error(`Неизвестное задание: «${kind}»`);
    }

    const next = page.getByRole('button', { name: /дальше/i });
    await expect(next).toBeVisible();
    const fb = (await page.locator('[aria-live]').first().textContent()) ?? '';
    const v = /неверно/i.test(fb) ? 'wrong' : /почти/i.test(fb) ? 'almost' : 'correct';
    verdicts[v] = (verdicts[v] ?? 0) + 1;
    if (v !== 'correct') throw new Error(`Правильный ответ не засчитан: «${kind}» / «${shown}»: ${fb}`);
    await next.click();
  }
  throw new Error('Урок не закончился за 120 шагов');
}

/** Ответить правильно на текущее задание урока грамматики по данным урока. */
export async function answerGrammar(page: Page, lesson: { exercises: Exercise[] }) {
  const text = squash((await page.locator('.text-2xl.leading-snug').first().textContent()) ?? '');
  const ex = lesson.exercises.find((e) =>
    e.kind === 'choose' ? squash(e.prompt) === text : e.kind === 'gap' ? squash(e.sentence.replace('___', '')) === text : squash(e.statement) === text,
  );
  if (!ex) throw new Error(`Задание не найдено в уроке: ${text}`);
  const right = ex.kind === 'truefalse' ? (ex.answer ? 'Верно' : 'Неверно') : ex.options[ex.answer];
  await page.locator('button.min-h-14').filter({ hasText: exact(right) }).click();
  await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
}
