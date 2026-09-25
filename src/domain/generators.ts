import type { Word } from '../content/schema';
import { definiteArticles, splitArticle } from './answer';

export type Rng = () => number;

/** Детерминированный генератор для тестов (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let seq = 0;
export const nextId = () => `s${++seq}`;

export interface ChoiceData {
  options: string[];
  answer: number;
}

function locationOf(w: Word) {
  return w.id.split('.')[0];
}

/**
 * 4 варианта. Дистракторы: сначала та же локация, та же часть речи и тот же род
 * (чтобы ответ не угадывался по артиклю), потом та же часть речи, потом любые.
 */
export function makeChoice(word: Word, pool: Word[], dir: 'es-ru' | 'ru-es', rng: Rng): ChoiceData {
  const shown = (w: Word) => (dir === 'es-ru' ? w.ru : w.es);
  const target = shown(word);
  const score = (w: Word) =>
    (w.pos === word.pos ? 4 : 0) +
    (w.pos === 'noun' && w.gender === word.gender ? 2 : 0) +
    (locationOf(w) === locationOf(word) ? 1 : 0);
  const candidates = shuffle(
    pool.filter((w) => w.id !== word.id && shown(w) !== target && w.ru !== word.ru),
    rng,
  ).sort((a, b) => score(b) - score(a));

  const picked: string[] = [];
  for (const c of candidates) {
    const s = shown(c);
    if (!picked.includes(s)) picked.push(s);
    if (picked.length === 3) break;
  }
  const options = shuffle([target, ...picked], rng);
  return { options, answer: options.indexOf(target) };
}

export interface ScrambleData {
  /** Варианты артикля для переключателя или null, если слово без артикля. */
  articles: string[] | null;
  article: string | null;
  core: string;
  letters: string[];
}

export function canScramble(word: Word): boolean {
  const { core } = splitArticle(word.es);
  return !core.includes(' ') && core.length >= 3 && core.length <= 10;
}

export function makeScramble(word: Word, rng: Rng): ScrambleData {
  const { article, core } = splitArticle(word.es);
  const chars = [...core];
  let letters = shuffle(chars, rng);
  for (let i = 0; i < 10 && letters.join('') === core; i++) letters = shuffle(chars, rng);
  let articles: string[] | null = null;
  if (article) {
    const { singular, plural } = definiteArticles();
    articles = plural.includes(article) ? plural : singular;
  }
  return { articles, article, core, letters };
}

export interface PhraseData {
  tokens: string[];
  answer: string[];
}

const PHRASE_PUNCT = /[¿¡?!.,;:"«»()…—–]/g;

export function phraseTokens(sentence: string): string[] {
  const t = sentence.replace(PHRASE_PUNCT, ' ').split(/\s+/).filter(Boolean);
  if (t.length) t[0] = t[0][0].toLowerCase() + t[0].slice(1);
  return t;
}

export function canPhrase(word: Word): boolean {
  const n = phraseTokens(word.example.es).length;
  return n >= 3 && n <= 9;
}

/** Только слова самой фразы, без лишних: перемешаны так, чтобы порядок не совпадал с ответом. */
export function makePhrase(word: Word, rng: Rng): PhraseData {
  const answer = phraseTokens(word.example.es);
  let tokens = shuffle(answer, rng);
  for (let i = 0; i < 10 && tokens.join(' ') === answer.join(' '); i++) tokens = shuffle(answer, rng);
  return { answer, tokens };
}

export interface MatchData {
  wordIds: string[];
  left: string[];
  right: string[];
}

export function makeMatch(words: Word[], rng: Rng): MatchData {
  const ids = shuffle(words, rng)
    .slice(0, 5)
    .map((w) => w.id);
  return { wordIds: ids, left: shuffle(ids, rng), right: shuffle(ids, rng) };
}
