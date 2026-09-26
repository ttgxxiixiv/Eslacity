import type { Phrase } from '../content/schema';
import { normalize, type Verdict } from './answer';
import { shuffle, type Rng } from './generators';
import { fullPhrase } from './phrase';
import type { Grade, SrsCard } from './srs';
import { gradeFor } from './srs';

/**
 * Задания фраз мест (задача 4.3): выбор фразы по переводу, сборка из плиток с двумя лишними словами
 * и ввод фразы по переводу. В уроке каждая фраза проходит все три, в повторении — одно.
 */
export type PhraseStep =
  | { kind: 'intro'; id: string }
  | { kind: 'choose'; id: string; options: string[] }
  | { kind: 'tiles'; id: string; tiles: string[] }
  | { kind: 'type'; id: string };

/** Лишних плиток в сборке. */
export const EXTRA_TILES = 2;

/**
 * Слова фразы как плитки: без знаков препинания. Первое слово строчное, иначе заглавная буква подсказывала бы
 * начало фразы (аббревиатуры вроде DNI остаются как есть).
 */
export function phraseTokens(text: string): string[] {
  const tokens = fullPhrase(text)
    .replace(/[¿¡?!.,;:"«»()…—–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens[0] && tokens[0] !== tokens[0].toUpperCase()) tokens[0] = tokens[0].toLowerCase();
  return tokens;
}

/** Плитки: слова фразы и две лишних из других фраз места, которых во фразе нет. */
export function makeTiles(phrase: Phrase, pool: Phrase[], rng: Rng): string[] {
  const own = phraseTokens(phrase.es);
  const has = new Set(own.map((t) => normalize(t)));
  const extra: string[] = [];
  for (const p of shuffle(pool.filter((x) => x.id !== phrase.id), rng)) {
    for (const t of shuffle(phraseTokens(p.es), rng)) {
      const k = normalize(t);
      if (extra.length < EXTRA_TILES && !has.has(k)) {
        extra.push(t);
        has.add(k);
      }
    }
    if (extra.length >= EXTRA_TILES) break;
  }
  return shuffle([...own, ...extra], rng);
}

/** Четыре варианта (id фраз): верная и три другие фразы места. */
export function makeOptions(phrase: Phrase, pool: Phrase[], rng: Rng): string[] {
  const others = shuffle(pool.filter((p) => p.id !== phrase.id && normalize(p.es) !== normalize(phrase.es)), rng).slice(0, 3);
  return shuffle([phrase.id, ...others.map((p) => p.id)], rng);
}

/** Урок новых фраз: знакомство со всеми, затем выбор, сборка и ввод — по кругу, от простого к трудному. */
export function learnPhraseSteps(phrases: Phrase[], pool: Phrase[], rng: Rng): PhraseStep[] {
  const steps: PhraseStep[] = phrases.map((p) => ({ kind: 'intro', id: p.id }));
  for (const p of shuffle(phrases, rng)) steps.push({ kind: 'choose', id: p.id, options: makeOptions(p, pool, rng) });
  for (const p of shuffle(phrases, rng)) steps.push({ kind: 'tiles', id: p.id, tiles: makeTiles(p, pool, rng) });
  for (const p of shuffle(phrases, rng)) steps.push({ kind: 'type', id: p.id });
  return steps;
}

/** Повторение: одно задание на фразу. Молодая фраза собирается из плиток, закрепившаяся вводится целиком. */
export function reviewPhraseSteps(phrases: Phrase[], cards: Record<string, SrsCard>, pool: Phrase[], rng: Rng): PhraseStep[] {
  return shuffle(phrases, rng).map((p): PhraseStep =>
    (cards[p.id]?.stability ?? cards[p.id]?.interval ?? 0) < 7
      ? { kind: 'tiles', id: p.id, tiles: makeTiles(p, pool, rng) }
      : { kind: 'type', id: p.id },
  );
}

/** Оценка фразы за сессию — худшая из её заданий; ввод без ошибок ценится выше выбора. */
export function lowerGrade(grades: Record<string, Grade>, id: string, verdict: Verdict, typed: boolean) {
  const g = gradeFor(verdict, typed);
  grades[id] = Math.min(grades[id] ?? 5, g) as Grade;
}
