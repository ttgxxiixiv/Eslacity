import type { Phrase, Word } from '../content/schema';
import { makeStep, type Step } from './lessonQueue';
import { makeTiles, type PhraseStep } from './phraseSteps';
import { shuffle, type Rng } from './generators';

/**
 * Испытание места (задача 5.1): экзамен по словам и фразам главы одного места. 15 заданий вперемешку,
 * больше половины — ввод с клавиатуры. Ошибки не возвращаются в очередь, подсказок нет. Засчитано при 80%
 * верных ответов («почти» — опечатка или ударение — тоже верно). Не прошёл — следующая попытка через сутки.
 * Пройденное испытание — условие обрывка карты этой главы и шаг линии медалей «Испытатель».
 */

export const TRIAL_SIZE = 15;
export const TRIAL_PASS = 0.8;
export const TRIAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Фраз в испытании не больше этого, остальное — слова. */
export const TRIAL_PHRASES = 5;
/** Доля заданий с вводом: 9 из 15. */
export const TRIAL_TYPED = 0.6;
/** Награда за первое прохождение. */
export const TRIAL_REWARD = { coins: 40 };

export const trialId = (place: string, chapter: number) => `tr:${place}.${chapter}`;

export function parseTrialId(id: string): { place: string; chapter: number } | null {
  const m = id.match(/^tr:([a-z]+)\.(\d)$/);
  return m ? { place: m[1], chapter: Number(m[2]) } : null;
}

export type TrialItem = { kind: 'word'; step: Step } | { kind: 'phrase'; step: PhraseStep };

/** Задание испытания с вводом с клавиатуры. */
export const isTypedItem = (it: TrialItem) =>
  it.kind === 'word' ? it.step.kind === 'type' || it.step.kind === 'listen-type' : it.step.kind === 'type';

/**
 * Задания испытания: до пяти выученных фраз главы и слова главы до пятнадцати, каждое по одному разу.
 * Ввод — у 60% заданий (фразы и слова поровну по доле), остальное — выбор, сборка слова из букв и плитки фразы.
 */
export function buildTrial(
  words: Word[], phrases: Phrase[], wordPool: Word[], phrasePool: Phrase[], rng: Rng, opts: { listening?: boolean } = {},
): TrialItem[] {
  const listening = opts.listening ?? true;
  const ph = shuffle(phrases, rng).slice(0, TRIAL_PHRASES);
  const ws = shuffle(words, rng).slice(0, TRIAL_SIZE - ph.length);
  const total = ph.length + ws.length;
  const typed = Math.ceil(total * TRIAL_TYPED);
  const phTyped = Math.min(ph.length, Math.round(ph.length * TRIAL_TYPED));
  const wTyped = Math.min(ws.length, typed - phTyped);

  const items: TrialItem[] = ph.map((p, i) => ({
    kind: 'phrase',
    step: i < phTyped ? { kind: 'type', id: p.id } : { kind: 'tiles', id: p.id, tiles: makeTiles(p, phrasePool, rng) },
  }));
  const other: Step['kind'][] = listening ? ['choice-ru-es', 'scramble', 'listen-choice'] : ['choice-ru-es', 'scramble'];
  ws.forEach((w, i) => {
    // Один диктант на слух среди вводов, если слушать можно.
    const kind = i < wTyped ? (listening && i === 0 ? 'listen-type' : 'type') : other[(i - wTyped) % other.length];
    items.push({ kind: 'word', step: makeStep(kind as Exclude<Step['kind'], 'match'>, w, wordPool, rng) });
  });
  return shuffle(items, rng);
}

/** Доля верных: «почти» засчитывается. */
export const trialShare = (correct: number, almost: number, total: number) => (total > 0 ? (correct + almost) / total : 0);
export const isTrialPassed = (correct: number, almost: number, total: number) => total > 0 && trialShare(correct, almost, total) >= TRIAL_PASS;

/** Прохождения испытания: попытки, лучший результат, время последней неудачи и прохождения. */
export interface TrialRecord {
  attempts: number;
  best: number;
  /** Когда закончилась последняя неудачная попытка: от неё отсчитываются сутки. */
  failedAt?: number;
  done?: number;
}

export type TrialsData = Record<string, TrialRecord>;

export type TrialStatus =
  | { kind: 'locked'; wordsLeft: number }
  | { kind: 'open' }
  | { kind: 'wait'; until: number }
  | { kind: 'done' };

/** Испытание открывается, когда выучены все слова главы в месте. После неудачи — через сутки. */
export function trialStatus(rec: TrialRecord | undefined, wordsLeft: number, now: number): TrialStatus {
  if (rec?.done !== undefined) return { kind: 'done' };
  if (wordsLeft > 0) return { kind: 'locked', wordsLeft };
  if (rec?.failedAt !== undefined && now < rec.failedAt + TRIAL_COOLDOWN_MS) return { kind: 'wait', until: rec.failedAt + TRIAL_COOLDOWN_MS };
  return { kind: 'open' };
}

/** Записать законченную попытку. first — испытание пройдено впервые (за это награда). */
export function finishTrial(prev: TrialRecord | undefined, share: number, passed: boolean, now: number): { rec: TrialRecord; first: boolean } {
  const p = prev ?? { attempts: 0, best: 0 };
  const first = passed && p.done === undefined;
  const rec: TrialRecord = { attempts: p.attempts + 1, best: Math.max(p.best, share) };
  if (p.done !== undefined || passed) rec.done = p.done ?? now;
  else rec.failedAt = now;
  return { rec, first };
}

export const isTrialDone = (records: TrialsData, place: string, chapter: number) => records[trialId(place, chapter)]?.done !== undefined;

/** Пройденные испытания: счётчик линии «Испытатель» (стражи добавятся с задачей 5.4). */
export const trialsPassed = (records: TrialsData) => Object.values(records).filter((r) => r.done !== undefined).length;

/** «через 5 ч» / «через 40 мин» до следующей попытки. */
export function waitLabel(until: number, now: number): string {
  const min = Math.max(1, Math.ceil((until - now) / 60000));
  return min >= 60 ? `через ${Math.ceil(min / 60)} ч` : `через ${min} мин`;
}
