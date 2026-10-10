import type { Rumor, Word } from '../content/schema';
import { normalize, splitArticle } from './answer';
import { isExpression } from './expression';
import { shuffle, type Rng } from './generators';

/**
 * Слухи города (задача 13.7): раз в день короткое событие на данных из уже выученного. Вид события идёт по кругу
 * по дням: гость на площади спрашивает слово (слушать и выбрать перевод), кот утащил слово с рынка (собрать
 * из букв), объявление на почте (прочитать пример и выбрать перевод). Верный ответ — монеты и слух: реплика жителя
 * о сюжете, кусочек лора для Дневника (13.8). Ошибка не наказывается: событие строится заново из другого слова.
 */

export type RumorKind = 'guest' | 'cat' | 'notice';
export const RUMOR_KINDS: RumorKind[] = ['guest', 'cat', 'notice'];

/** Где случается событие: место города, его житель рассказывает слух. */
export const RUMOR_PLACE: Record<RumorKind, string> = { guest: 'park', cat: 'market', notice: 'post' };

export const RUMOR_TITLE: Record<RumorKind, string> = {
  guest: 'Гость на площади',
  cat: 'Кот с рынка',
  notice: 'Объявление на почте',
};

/** Сколько выученных слов нужно, чтобы событие было из чего собрать. */
export const RUMOR_MIN_WORDS = 8;
/** Монеты за событие в главе I, дальше растут вместе с ценами лавки. */
export const RUMOR_COINS = 15;
/** Вариантов ответа в выборе. */
export const RUMOR_OPTIONS = 4;
/** Длина слова, которое утащил кот: короткое — не задача, длинное — каша из букв. */
export const CAT_LETTERS: [number, number] = [4, 9];

/** Вид события дня. */
export const rumorKind = (day: number): RumorKind => RUMOR_KINDS[((day % RUMOR_KINDS.length) + RUMOR_KINDS.length) % RUMOR_KINDS.length];

export type RumorEvent =
  | { kind: 'guest'; word: Word; options: string[]; answer: string }
  | { kind: 'cat'; word: Word; letters: string[]; answer: string }
  | { kind: 'notice'; word: Word; text: string; options: string[]; answer: string };

/** Слово без артикля, если это одно слово из букв подходящей длины. */
export function catWord(w: Word): string | null {
  const core = splitArticle(w.es).core;
  return /^\p{L}+$/u.test(core) && core.length >= CAT_LETTERS[0] && core.length <= CAT_LETTERS[1] ? core : null;
}

/** Варианты: верный и другие с непохожим ответом (одинаковые переводы в выборе дали бы два верных). */
function pickOptions(word: Word, pool: Word[], key: (w: Word) => string, rng: Rng): string[] {
  const right = key(word);
  const seen = new Set([normalize(right)]);
  const others: string[] = [];
  for (const w of shuffle(pool, rng)) {
    const k = key(w);
    if (seen.has(normalize(k))) continue;
    seen.add(normalize(k));
    others.push(k);
    if (others.length === RUMOR_OPTIONS - 1) break;
  }
  return shuffle([right, ...others], rng);
}

/**
 * Событие дня из выученных слов. Выражения уровня 7 не берутся: их перевод длинный, а кот выражение не утащит.
 * null — не из чего собрать (мало слов или нет подходящего для кота).
 */
export function buildRumorEvent(kind: RumorKind, learned: Word[], rng: Rng): RumorEvent | null {
  const pool = learned.filter((w) => !isExpression(w));
  if (pool.length < RUMOR_MIN_WORDS) return null;
  if (kind === 'cat') {
    const fit = shuffle(pool.filter((w) => catWord(w)), rng);
    const word = fit[0];
    if (!word) return null;
    const answer = catWord(word)!;
    let letters = shuffle([...answer], rng);
    // Буквы не должны сразу стоять по порядку.
    for (let i = 0; i < 5 && letters.join('') === answer; i++) letters = shuffle([...answer], rng);
    return { kind, word, letters, answer };
  }
  const word = shuffle(pool, rng)[0];
  if (kind === 'guest') return { kind, word, options: pickOptions(word, pool, (w) => w.ru, rng), answer: word.ru };
  return { kind, word, text: word.example.es, options: pickOptions(word, pool, (w) => w.example.ru, rng), answer: word.example.ru };
}

/** Ответ верен: у кота — собранное слово без учёта регистра, у выбора — тот же вариант. */
export const rumorRight = (ev: RumorEvent, given: string) => normalize(given) === normalize(ev.answer);

/** Монеты за событие: растут с главой, как цены лавки. */
export const rumorCoins = (factor: number) => RUMOR_COINS * factor;

export interface RumorsRecord {
  /** День последнего пройденного события. */
  day?: number;
  /** Полученные слухи по порядку. */
  got: string[];
}

export const EMPTY_RUMORS: RumorsRecord = { got: [] };

/** Событие сегодня ещё не пройдено. */
export const rumorDue = (rec: RumorsRecord, day: number) => rec.day !== day;

/** Следующий слух: первый неполученный из открытых глав, по главам и порядку в файле. Все получены — null. */
export function nextRumor(rumors: Rumor[], got: readonly string[], opened: number): Rumor | null {
  const have = new Set(got);
  return [...rumors].filter((r) => r.chapter <= opened && !have.has(r.id)).sort((a, b) => a.chapter - b.chapter)[0] ?? null;
}
