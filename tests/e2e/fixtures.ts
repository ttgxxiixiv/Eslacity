import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export type Lang = 'es' | 'it';
export const LANGS: Lang[] = ['es', 'it'];

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
/** Имя базы IndexedDB для языка: у испанского прежнее имя. */
export const DB: Record<Lang, string> = { es: 'eslacity', it: 'eslacity-it' };
/** Наречие в заголовках заданий: «Как сказать по-испански?». */
export const ADVERB: Record<Lang, string> = { es: 'по-испански', it: 'по-итальянски' };

interface Word {
  id: string;
  es: string;
  ru: string;
  example: { es: string; ru: string };
}

/** Все слова языка: чтобы ответить на задание по тому, что показано на экране. */
export function loadWords(lang: Lang) {
  const dir = join(CONTENT, lang, 'words');
  const scrolls = join(CONTENT, lang, 'scrolls');
  const words: Word[] = [
    ...readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).words),
    ...readdirSync(scrolls).flatMap((f) => JSON.parse(readFileSync(join(scrolls, f), 'utf8')).words),
  ];
  return {
    byRu: new Map(words.map((w) => [w.ru, w])),
    byEs: new Map(words.map((w) => [w.es, w])),
    byExRu: new Map(words.map((w) => [w.example.ru, w])),
    byId: new Map(words.map((w) => [w.id, w])),
  };
}

/** id слов места на указанных уровнях. */
export function wordIdsOf(lang: Lang, location: string, levels: number[]): string[] {
  const data = JSON.parse(readFileSync(join(CONTENT, lang, 'words', `${location}.json`), 'utf8')) as { words: { id: string; level: number }[] };
  return data.words.filter((w) => levels.includes(w.level)).map((w) => w.id);
}

/** id слов свитка главы. */
export function scrollIdsOf(lang: Lang, chapter: number): string[] {
  const data = JSON.parse(readFileSync(join(CONTENT, lang, 'scrolls', `${chapter}.json`), 'utf8')) as { words: { id: string }[] };
  return data.words.map((w) => w.id);
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

type Exercise = { id: string } & (
  | { kind: 'choose'; prompt: string; options: string[]; answer: number }
  | { kind: 'gap'; sentence: string; options: string[]; answer: number }
  | { kind: 'truefalse'; statement: string; answer: boolean }
  | { kind: 'build'; ru: string; answer: string; extra: string[] }
  | { kind: 'type'; sentence: string; ru: string; answer: string }
  // Задания C1 (задача 7.3).
  | { kind: 'transform' | 'combine'; answer: string }
  | { kind: 'cloze'; answers: string[][] }
  | { kind: 'fix'; wrong: number; answer: string }
  | { kind: 'register'; options?: string[]; answer: number | string }
  | { kind: 'paraphrase'; options: string[]; answer: number }
);

const C1_KINDS = new Set(['transform', 'combine', 'cloze', 'fix', 'register', 'paraphrase']);

/** Ответ на задание C1: задание узнаётся по `data-ex`, отвечаем по данным урока. */
async function answerC1(page: Page, ex: Exercise, wrong: boolean) {
  const check = () => page.getByRole('button', { name: 'Проверить' }).click();
  const pick = async (options: string[], answer: number) => {
    const text = wrong ? options.find((_, i) => i !== answer)! : options[answer];
    await page.locator('button.min-h-14').filter({ hasText: exact(text) }).click();
  };
  if (ex.kind === 'transform' || ex.kind === 'combine') {
    await page.locator('input').fill(wrong ? 'xxx' : ex.answer);
    await check();
  } else if (ex.kind === 'cloze') {
    const inputs = page.locator('input[aria-label^="Пропуск"]');
    for (let i = 0; i < ex.answers.length; i++) await inputs.nth(i).fill(wrong ? 'xxx' : ex.answers[i][0]);
    await check();
  } else if (ex.kind === 'fix') {
    const words = page.getByTestId('fix-words').locator('button');
    await words.nth(wrong ? (ex.wrong + 1) % (await words.count()) : ex.wrong).click();
    await page.locator('input').fill(ex.answer);
    await check();
  } else if (ex.kind === 'paraphrase') {
    await pick(ex.options, ex.answer);
  } else if (ex.kind === 'register') {
    if (ex.options && typeof ex.answer === 'number') await pick(ex.options, ex.answer);
    else {
      const words = phraseTiles(String(ex.answer));
      for (const t of wrong ? [...words].reverse() : words) {
        await page.getByTestId('grammar-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
      }
      await check();
    }
  }
}

export function loadLesson(lang: Lang, district: string, file: string): { id: string; exercises: Exercise[] } {
  return JSON.parse(readFileSync(join(CONTENT, lang, 'grammar', district, `${file}.json`), 'utf8'));
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const exact = (s: string) => new RegExp(`^${esc(s)}$`);
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

    if (kind === 'Новое слово' || kind === 'Новое выражение') {
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

/**
 * Ответить на текущее задание урока грамматики по данным урока: правильно или, если `wrong`, нарочно неверно.
 * Возвращает id упражнения.
 */
export async function answerGrammar(page: Page, lesson: { exercises: Exercise[] }, wrong = false): Promise<string> {
  const exId = await page.locator('[data-ex]').first().getAttribute('data-ex');
  const c1 = lesson.exercises.find((e) => e.id === exId && C1_KINDS.has(e.kind));
  if (c1) {
    await answerC1(page, c1, wrong);
    await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
    return c1.id;
  }
  // Сборка и ввод формы: задание ищется по переводу, ответ — плитками или в поле.
  if (await page.getByTestId('grammar-prompt').count()) {
    const ru = squash((await page.getByTestId('grammar-prompt').textContent()) ?? '');
    const tiles = await page.getByTestId('grammar-tiles').count();
    const ex = lesson.exercises.find((e) =>
      tiles ? e.kind === 'build' && squash(e.ru) === ru : e.kind === 'type' && squash(e.sentence.replace('___', '')) === ru,
    );
    if (!ex) throw new Error(`Задание не найдено в уроке: ${ru}`);
    if (ex.kind === 'build') {
      const words = phraseTiles(ex.answer);
      for (const t of wrong ? [...words].reverse() : words) {
        await page.getByTestId('grammar-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
      }
      await page.getByRole('button', { name: 'Проверить' }).click();
    } else if (ex.kind === 'type') {
      await page.locator('input').fill(wrong ? 'xxx' : ex.answer);
      await page.getByRole('button', { name: 'Проверить' }).click();
    }
    await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
    return ex.id;
  }
  const text = squash((await page.locator('.text-2xl.leading-snug').first().textContent()) ?? '');
  type Choice = Extract<Exercise, { kind: 'choose' | 'gap' | 'truefalse' }>;
  const same = lesson.exercises.filter((e): e is Choice =>
    e.kind === 'choose' ? squash(e.prompt) === text : e.kind === 'gap' ? squash(e.sentence.replace('___', '')) === text : e.kind === 'truefalse' && squash(e.statement) === text,
  );
  // Одинаковый вопрос («Как правильно?») у нескольких заданий: различаем по вариантам на экране.
  const shown = same.length > 1 ? (await page.locator('button.min-h-14').allTextContents()).map(squash).sort().join('|') : '';
  const ex = same.length > 1 ? same.find((e) => 'options' in e && e.options.map(squash).sort().join('|') === shown) : same[0];
  if (!ex) throw new Error(`Задание не найдено в уроке: ${text}`);
  const right = ex.kind === 'truefalse' ? (ex.answer ? 'Верно' : 'Неверно') : ex.options[ex.answer];
  const other = ex.kind === 'truefalse' ? (ex.answer ? 'Неверно' : 'Верно') : ex.options.find((_, i) => i !== ex.answer)!;
  await page.locator('button.min-h-14').filter({ hasText: exact(wrong ? other : right) }).click();
  await expect(page.getByRole('button', { name: /дальше/i })).toBeVisible();
  return ex.id;
}

interface PhraseData {
  id: string;
  es: string;
  ru: string;
  level: number;
}

/** Фразы места из контента. */
export function loadPhraseData(lang: Lang, place: string): PhraseData[] {
  return JSON.parse(readFileSync(join(CONTENT, lang, 'phrases', `${place}.json`), 'utf8')).phrases;
}

/** Фраза целиком без скобок, как её показывает приложение. */
export const phraseFull = (es: string) => es.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
export const phraseTiles = (es: string) => {
  const t = phraseFull(es).replace(/[¿¡?!.,;:"«»()…—–]/g, ' ').split(/\s+/).filter(Boolean);
  if (t[0] !== t[0].toUpperCase()) t[0] = t[0].toLowerCase();
  return t;
};

/** Пройти урок или повторение фраз места, отвечая правильно на каждое задание. */
export async function playPhrases(page: Page, lang: Lang, place: string, done: RegExp): Promise<Record<string, number>> {
  const phrases = loadPhraseData(lang, place);
  const byRu = (ru: string) => phrases.find((p) => p.ru === ru)!;
  const kinds: Record<string, number> = {};
  const label = page.locator('[data-testid=phrase-run] .text-sm.font-medium.text-stone-500').first();
  for (let i = 0; i < 80; i++) {
    if (await page.getByText(done).count()) return kinds;
    const kind = (await label.textContent({ timeout: 3000 }).catch(() => null))?.trim();
    if (!kind) continue;
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    if (kind === 'Новая фраза') {
      await page.getByRole('button', { name: 'Понятно' }).click();
      continue;
    }
    const p = byRu(((await page.getByTestId('phrase-prompt').textContent()) ?? '').trim());
    if (kind === 'Выберите фразу') {
      await page.locator('button.min-h-14').filter({ hasText: exact(phraseFull(p.es)) }).click();
    } else if (kind === 'Соберите фразу из плиток') {
      for (const t of phraseTiles(p.es)) {
        await page.getByTestId('phrase-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
      }
      await page.getByRole('button', { name: 'Проверить' }).click();
    } else if (kind.startsWith('Напишите фразу')) {
      await page.locator('input').fill(phraseFull(p.es).replace("'", '’ '));
      await page.getByRole('button', { name: 'Проверить' }).click();
    } else {
      throw new Error(`Неизвестное задание фразы: «${kind}»`);
    }
    const next = page.getByRole('button', { name: /дальше/i });
    await expect(next).toBeVisible();
    const fb = (await page.locator('.sheet[aria-live]').textContent()) ?? '';
    if (!/верно!/i.test(fb)) throw new Error(`Фраза не засчитана: «${kind}» / «${p.es}»: ${fb}`);
    await next.click();
  }
  throw new Error('Фразы не закончились');
}

/** id всех сюжетных миссий языка из контента. */
export function missionIdsOf(lang: Lang): string[] {
  const dir = join(CONTENT, lang, 'missions');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')).missions as { id: string }[]).map((m) => m.id));
}

/** Отметить сюжетные миссии пройденными (без перезагрузки: следующий seed или reload её сделает). */
export async function seedMissionsDone(page: Page, lang: Lang, ids: string[]) {
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'missions', value: Object.fromEntries(ids.map((id) => [id, { attempts: 1, best: 1, done: 1 }])) });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
}

/** Места города в порядке показа. */
export const PLACES = ['cafe', 'market', 'supermarket', 'restaurant', 'home', 'park', 'clothes', 'pharmacy', 'school', 'post',
  'bank', 'barber', 'gym', 'station', 'beach', 'office', 'hotel', 'hospital', 'airport', 'police'];

/** id испытаний всех мест главы. */
export const trialIdsOf = (chapter: number) => PLACES.map((p) => `tr:${p}.${chapter}`);

/** Отметить испытания мест пройденными (без перезагрузки: следующий seed или reload её сделает). */
export async function seedTrialsDone(page: Page, lang: Lang, ids: string[]) {
  await page.evaluate(
    ({ db, ids }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'trials', value: Object.fromEntries(ids.map((id) => [id, { attempts: 1, best: 1, done: 1 }])) });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids },
  );
}

/** Клавиши над полем в испытании: только буквы с ударением языка, без букв ответа. */
export const EXAM_KEYS: Record<Lang, string[]> = { es: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'], it: ['à', 'è', 'é', 'ì', 'ò', 'ù', "'"] };
export const expectExamKeys = async (page: Page, lang: Lang) =>
  expect(await page.getByTestId('trial-run').locator('form button.w-11').allTextContents()).toEqual(EXAM_KEYS[lang]);

/**
 * Пройти испытание места или стража. place — место (фразы испытания), lessons — упражнения уроков (у стражей).
 * wrong — сколько первых заданий ответить неверно (ввод «xxx», в выборе — не тот вариант). Возвращает, сколько было
 * заданий всего и с вводом.
 */
export async function playTrial(
  page: Page, lang: Lang, place: string | null, wrong = 0, lessons: Exercise[] = [],
): Promise<{ total: number; typed: number }> {
  const { byRu, byEs, byId } = loadWords(lang);
  const phrases = place ? loadPhraseData(lang, place) : [];
  const run = page.getByTestId('trial-run');
  const label = run.locator('.text-sm.font-medium.text-stone-500').first();
  const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said.at(-1) ?? '');
  let total = 0;
  let typed = 0;
  for (let i = 0; i < 40; i++) {
    if (await page.locator('[data-testid=trial-result], [data-testid=guardian-result], [data-testid=placement-between], [data-testid=placement-result]').count()) {
      return { total, typed };
    }
    const kind = (await label.textContent({ timeout: 3000 }).catch(() => null))?.trim();
    if (!kind) continue;
    const bad = total < wrong;
    total++;
    // Упражнение грамматики (у него есть `data-ex`) отвечается по урокам (`answerGrammar`).
    const exId = (await run.locator('[data-ex]').count()) ? await run.locator('[data-ex]').first().getAttribute('data-ex') : null;
    if (exId?.startsWith('echo:')) {
      // «Эхо» в испытании главы V: житель говорит пару, герой отвечает выражением (плитки или выбор).
      const target = byId.get(exId.slice('echo:'.length))!;
      if (await run.getByTestId('grammar-tiles').count()) {
        const tiles = phraseTiles(target.es);
        for (const t of bad ? tiles.slice(1) : tiles) {
          await run.getByTestId('grammar-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
        }
        await page.getByRole('button', { name: 'Проверить' }).click();
      } else {
        const options = run.locator('button.min-h-14');
        await (bad ? options.filter({ hasNotText: exact(target.es) }) : options.filter({ hasText: exact(target.es) })).first().click();
      }
    } else if (exId) {
      if (kind === 'Впишите форму') {
        typed++;
        await expectExamKeys(page, lang);
      }
      await answerGrammar(page, { exercises: lessons }, bad);
    } else if (await run.getByTestId('phrase-prompt').count()) {
      const prompt = ((await run.getByTestId('phrase-prompt').textContent()) ?? '').trim();
      const p = phrases.find((x) => x.ru === prompt)!;
      if (kind === 'Соберите фразу из плиток') {
        const tiles = phraseTiles(p.es);
        for (const t of bad ? tiles.slice(1) : tiles) {
          await run.getByTestId('phrase-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
        }
        await page.getByRole('button', { name: 'Проверить' }).click();
      } else {
        typed++;
        await expectExamKeys(page, lang);
        await page.locator('input').fill(bad ? 'xxx' : phraseFull(p.es).replace("'", '’ '));
        await page.getByRole('button', { name: 'Проверить' }).click();
      }
    } else {
      const shown = ((await run.locator('.text-3xl.font-bold, .text-2xl.font-bold').first().textContent({ timeout: 3000 }).catch(() => '')) ?? '').trim();
      const options = run.locator('button.min-h-14');
      if (kind === `Как сказать ${ADVERB[lang]}?`) {
        const right = byRu.get(shown)!.es;
        await (bad ? options.filter({ hasNotText: exact(right) }) : options.filter({ hasText: exact(right) })).first().click();
      } else if (kind === 'Выберите перевод') {
        const right = byEs.get(shown)!.ru;
        await (bad ? options.filter({ hasNotText: exact(right) }) : options.filter({ hasText: exact(right) })).first().click();
      } else if (kind === 'Что вы услышали?') {
        await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
        const right = byEs.get(await said())!.ru;
        await (bad ? options.filter({ hasNotText: exact(right) }) : options.filter({ hasText: exact(right) })).first().click();
      } else if (kind === 'Соберите слово') {
        const w = byRu.get(shown)!;
        const m = w.es.match(/^(l'|el |la |los |las |il |lo |i |gli |le )(.*)$/);
        const [art, core] = m ? [m[1].trim(), m[2]] : [null, w.es];
        if (art) await page.locator('button.h-12.flex-1').filter({ hasText: exact(art) }).click();
        const letters = bad ? [...core].reverse() : [...core];
        for (const ch of letters) await page.locator('button.min-w-12:not([disabled])').filter({ hasText: exact(ch) }).first().click();
        await page.getByRole('button', { name: 'Проверить' }).click();
      } else if (kind === `Напишите ${ADVERB[lang]}` || kind === 'Напишите, что услышали') {
        typed++;
        await expectExamKeys(page, lang);
        let text = 'xxx';
        if (!bad && kind === 'Напишите, что услышали') {
          await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
          text = await said();
        } else if (!bad) text = byRu.get(shown)!.es.replace("'", '’ ');
        await page.locator('input').fill(text);
        await page.locator('button[type=submit]').click();
      } else {
        throw new Error(`Неизвестное задание испытания: «${kind}»`);
      }
    }
    const next = page.getByRole('button', { name: /дальше/i });
    await expect(next).toBeVisible();
    const fb = (await page.locator('[aria-live]').first().textContent()) ?? '';
    if (!bad && /неверно/i.test(fb)) throw new Error(`Правильный ответ не засчитан: «${kind}»: ${fb}`);
    await next.click();
  }
  throw new Error('Испытание не закончилось');
}
