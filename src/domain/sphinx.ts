/**
 * Сфинкс у Врат Хранилища (задача 8.2, docs/GAME.md «Хранилище и Сфинкс»). Три раунда по порядку: слух, слово,
 * мудрость. На всю встречу три сердца, раунд засчитан при 80% верных («почти» — тоже верно). Проваленный раунд
 * стоит сердце и повторяется по следующему набору. Сердца кончились — Сфинкс ждёт три дня, потом встреча
 * начинается с тремя сердцами. Пройденные раунды не отнимаются. Времени на ответ нет.
 */

import type { SphinxFile } from '../content/schema';
import { shuffle, type Rng } from './generators';
import { toItem } from './grammar';
import type { TrialItem } from './trial';

export const SPHINX_ROUNDS = ['hear', 'word', 'wisdom'] as const;
export type SphinxRound = (typeof SPHINX_ROUNDS)[number];

export const SPHINX_HEARTS = 3;
export const SPHINX_PASS = 0.8;
export const SPHINX_WAIT_MS = 3 * 24 * 60 * 60 * 1000;
/** Наборов в каждом раунде (`sphinx.json`, задача 8.1). */
export const SPHINX_SET_COUNT = 3;

export interface SphinxRecord {
  /** Первый приход к Вратам (тайная медаль «Взгляд Сфинкса»). */
  visited?: number;
  /** Сердца текущей встречи. */
  hearts: number;
  /** Когда раунд пройден. */
  rounds: Partial<Record<SphinxRound, number>>;
  /** Сколько раз раунд начинали и заканчивали: по этому числу выбирается набор. */
  attempts: Partial<Record<SphinxRound, number>>;
  /** Сердца кончились: до этого времени Сфинкс не принимает. */
  waitUntil?: number;
  /** Все три загадки разгаданы. */
  done?: number;
}

export const EMPTY_SPHINX: SphinxRecord = { hearts: SPHINX_HEARTS, rounds: {}, attempts: {} };

export type SphinxStatus = 'done' | 'waiting' | 'open';

/** Состояние Врат сейчас. Ожидание, которое уже прошло, — снова открыто. */
export function sphinxStatus(r: SphinxRecord, now: number): SphinxStatus {
  if (r.done !== undefined) return 'done';
  if (r.waitUntil !== undefined && now < r.waitUntil) return 'waiting';
  return 'open';
}

/** Первый не пройденный раунд или null, если пройдены все. */
export function nextRound(r: SphinxRecord): SphinxRound | null {
  return SPHINX_ROUNDS.find((k) => r.rounds[k] === undefined) ?? null;
}

/** Номер набора раунда (0..2): каждая следующая попытка идёт по другому набору. */
export const setIndex = (r: SphinxRecord, round: SphinxRound) => (r.attempts[round] ?? 0) % SPHINX_SET_COUNT;

/** Засчитан ли раунд: доля верных (с «почти») не меньше 80%. */
export const roundPassed = (good: number, total: number) => total > 0 && good / total >= SPHINX_PASS - 1e-9;

/**
 * Сердца к началу встречи: если ожидание прошло, сердца снова полные. Вызывается, когда герой подходит к Вратам.
 * Отметка первого прихода ставится здесь же.
 */
export function arrive(r: SphinxRecord, now: number): SphinxRecord {
  let next = r;
  if (next.visited === undefined) next = { ...next, visited: now };
  if (next.waitUntil !== undefined && now >= next.waitUntil) {
    next = { ...next, hearts: SPHINX_HEARTS };
    delete next.waitUntil;
  }
  return next;
}

export interface RoundResult {
  rec: SphinxRecord;
  passed: boolean;
  /** Встреча кончилась поражением: сердец не осталось. */
  exhausted: boolean;
  /** Этим раундом разгаданы все три загадки. */
  victory: boolean;
}

/** Итог раунда: попытка засчитывается, провал стоит сердце, последнее сердце — ожидание три дня. */
export function finishRound(r: SphinxRecord, round: SphinxRound, good: number, total: number, now: number): RoundResult {
  const passed = roundPassed(good, total);
  const attempts = { ...r.attempts, [round]: (r.attempts[round] ?? 0) + 1 };
  let rec: SphinxRecord = { ...r, attempts };
  if (passed) {
    rec.rounds = { ...r.rounds, [round]: r.rounds[round] ?? now };
    const victory = nextRound(rec) === null && rec.done === undefined;
    if (victory) rec.done = now;
    return { rec, passed, exhausted: false, victory };
  }
  const hearts = Math.max(0, r.hearts - 1);
  rec = { ...rec, hearts };
  const exhausted = hearts === 0;
  if (exhausted) rec.waitUntil = now + SPHINX_WAIT_MS;
  return { rec, passed, exhausted, victory: false };
}

/** «через 2 дн 5 ч» / «через 3 ч» до следующей встречи. */
export function sphinxWaitLabel(until: number, now: number): string {
  const h = Math.max(1, Math.ceil((until - now) / 3_600_000));
  const d = Math.floor(h / 24);
  return d > 0 ? `через ${d} дн${h % 24 ? ` ${h % 24} ч` : ''}` : `через ${h} ч`;
}

/** Печать этой главы открывает Врата на карте странствий. */
export const GATES_CHAPTER = 5;

/** Вопрос на понимание с перемешанными вариантами. */
function question(id: string, q: { q: string; options: string[]; answer: number }, rng: Rng): TrialItem {
  const right = q.options[q.answer];
  const options = shuffle(q.options, rng);
  return { kind: 'question', id, q: q.q, options, answer: options.indexOf(right) };
}

/**
 * Задания раунда по набору `set`: слух — вопросы к монологу, потом к спору; слово — десять заданий с вводом;
 * мудрость — пять вопросов к тексту, потом ответ Сфинксу официально и по-дружески.
 */
export function sphinxItems(file: SphinxFile, round: SphinxRound, set: number, rng: Rng): TrialItem[] {
  if (round === 'word') return file.word[set].exercises.map((ex) => ({ kind: 'grammar', item: toItem(ex, rng), cardId: ex.id }));
  if (round === 'hear') {
    const s = file.hear[set];
    const order = [...s.questions.filter((q) => q.part === 'monologue'), ...s.questions.filter((q) => q.part === 'dispute')];
    return order.map((q, k) => question(`${s.id}.q${k + 1}`, q, rng));
  }
  const s = file.wisdom[set];
  return [
    ...s.questions.map((q, k) => question(`${s.id}.q${k + 1}`, q, rng)),
    ...s.register.map((ex): TrialItem => ({ kind: 'grammar', item: toItem(ex, rng), cardId: ex.id })),
  ];
}
