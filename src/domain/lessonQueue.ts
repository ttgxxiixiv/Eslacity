import type { Word } from '../content/schema';
import type { Verdict } from './answer';
import type { Grade, SrsCard } from './srs';
import { gradeFor } from './srs';
import {
  type ChoiceData, type MatchData, type PhraseData, type Rng, type ScrambleData,
  canPhrase, canScramble, makeChoice, makeMatch, makePhrase, makeScramble, nextId, shuffle,
} from './generators';

export type Step =
  | { id: string; kind: 'intro'; wordId: string }
  | ({ id: string; kind: 'choice-es-ru' | 'choice-ru-es'; wordId: string } & ChoiceData)
  | ({ id: string; kind: 'scramble'; wordId: string } & ScrambleData)
  | ({ id: string; kind: 'phrase'; wordId: string } & PhraseData)
  | ({ id: string; kind: 'match' } & MatchData)
  | { id: string; kind: 'type'; wordId: string };

export type StepKind = Step['kind'];

export interface Outcome {
  verdict: Verdict;
  /** Для упражнения «пары»: результат по каждому слову. */
  perWord?: Record<string, Verdict>;
}

type SingleKind = Exclude<StepKind, 'match'>;

export function makeStep(kind: SingleKind, word: Word, pool: Word[], rng: Rng): Step {
  const id = nextId();
  switch (kind) {
    case 'intro':
      return { id, kind, wordId: word.id };
    case 'choice-es-ru':
      return { id, kind, wordId: word.id, ...makeChoice(word, pool, 'es-ru', rng) };
    case 'choice-ru-es':
      return { id, kind, wordId: word.id, ...makeChoice(word, pool, 'ru-es', rng) };
    case 'scramble':
      if (!canScramble(word)) return makeStep('choice-ru-es', word, pool, rng);
      return { id, kind, wordId: word.id, ...makeScramble(word, rng) };
    case 'phrase':
      if (!canPhrase(word)) return makeStep('choice-ru-es', word, pool, rng);
      return { id, kind, wordId: word.id, ...makePhrase(word, rng) };
    case 'type':
      return { id, kind, wordId: word.id };
  }
}

/**
 * Урок новых слов: знакомство + узнавание, пары, средний шаг (выбор/буквы/фраза),
 * в конце ввод с клавиатуры. От лёгкого к трудному.
 */
export function buildLearnSteps(words: Word[], pool: Word[], rng: Rng): Step[] {
  const steps: Step[] = [];
  for (const w of words) {
    steps.push(makeStep('intro', w, pool, rng));
    steps.push(makeStep('choice-es-ru', w, pool, rng));
  }
  if (words.length >= 3) steps.push({ id: nextId(), kind: 'match', ...makeMatch(words, rng) });
  const middle: SingleKind[] = ['choice-ru-es', 'scramble', 'phrase'];
  shuffle(words, rng).forEach((w, i) => steps.push(makeStep(middle[i % 3], w, pool, rng)));
  for (const w of shuffle(words, rng)) steps.push(makeStep('type', w, pool, rng));
  return steps;
}

/** Тип упражнения для повторения зависит от того, насколько слово закрепилось. */
export function reviewKind(card: SrsCard | undefined, i: number): SingleKind {
  const interval = card?.interval ?? 0;
  if (interval <= 1) return (['choice-ru-es', 'scramble', 'choice-es-ru'] as const)[i % 3];
  if (interval < 7) return (['phrase', 'type', 'choice-ru-es'] as const)[i % 3];
  return 'type';
}

export function buildReviewSteps(
  words: Word[], cards: Record<string, SrsCard>, pool: Word[], rng: Rng,
): Step[] {
  const steps: Step[] = [];
  if (words.length >= 5) {
    const weakest = words.slice().sort((a, b) => (cards[a.id]?.ef ?? 2.5) - (cards[b.id]?.ef ?? 2.5));
    steps.push({ id: nextId(), kind: 'match', ...makeMatch(weakest.slice(0, 5), rng) });
  }
  shuffle(words, rng).forEach((w, i) => steps.push(makeStep(reviewKind(cards[w.id], i), w, pool, rng)));
  return steps;
}

export interface SessionState {
  steps: Step[];
  index: number;
  /** Худшая оценка по каждому слову за сессию. */
  grades: Record<string, Grade>;
  correct: number;
  almost: number;
  wrong: number;
  mistakes: string[];
}

export function startSession(steps: Step[]): SessionState {
  return { steps, index: 0, grades: {}, correct: 0, almost: 0, wrong: 0, mistakes: [] };
}

function lower(grades: Record<string, Grade>, id: string, g: Grade) {
  grades[id] = Math.min(grades[id] ?? 5, g) as Grade;
}

/**
 * Записать ответ на текущий шаг. Ошибка добавляет в конец очереди новый шаг
 * того же типа по тому же слову (варианты генерируются заново).
 * Индекс не двигается: это делает `advance` после экрана с результатом.
 */
export function recordAnswer(
  s: SessionState, outcome: Outcome, retry: (step: Step) => Step | null,
): SessionState {
  const step = s.steps[s.index];
  const grades = { ...s.grades };
  const next = { ...s, grades };
  if (step.kind === 'intro') return next;

  if (step.kind === 'match') {
    for (const id of step.wordIds) lower(grades, id, gradeFor(outcome.perWord?.[id] ?? 'correct', false));
  } else {
    lower(grades, step.wordId, gradeFor(outcome.verdict, step.kind === 'type'));
  }

  if (outcome.verdict === 'correct') next.correct++;
  else if (outcome.verdict === 'almost') next.almost++;
  else {
    next.wrong++;
    if (step.kind !== 'match') {
      if (!next.mistakes.includes(step.wordId)) next.mistakes = [...next.mistakes, step.wordId];
      const r = retry(step);
      if (r) next.steps = [...s.steps, r];
    }
  }
  return next;
}

export function advance(s: SessionState): SessionState {
  return { ...s, index: s.index + 1 };
}

export function isFinished(s: SessionState): boolean {
  return s.index >= s.steps.length;
}
