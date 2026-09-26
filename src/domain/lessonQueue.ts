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
  | { id: string; kind: 'type'; wordId: string }
  // На слух: слово звучит, текста нет. Выбор перевода или диктант.
  | ({ id: string; kind: 'listen-choice'; wordId: string } & ChoiceData)
  | { id: string; kind: 'listen-type'; wordId: string };

export type StepKind = Step['kind'];

export interface Outcome {
  verdict: Verdict;
  /** Для упражнения «пары»: результат по каждому слову. */
  perWord?: Record<string, Verdict>;
}

type SingleKind = Exclude<StepKind, 'match'>;

export interface BuildOptions {
  /** false — без заданий на слух (нет синтеза речи или пользователь не может слушать). */
  listening?: boolean;
}

/** Задания, где ответ вводится с клавиатуры: для оценки SM-2 и серии «без опечаток». */
export function isTyped(kind: StepKind): boolean {
  return kind === 'type' || kind === 'listen-type';
}

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
    case 'listen-choice':
      return { id, kind, wordId: word.id, ...makeChoice(word, pool, 'es-ru', rng) };
    case 'listen-type':
      return { id, kind, wordId: word.id };
  }
}

/** Заменить задания на слух обычными: выбор перевода по тексту и ввод по переводу. */
export function withoutListening(steps: Step[]): Step[] {
  return steps.map((s) => {
    if (s.kind === 'listen-choice') return { ...s, kind: 'choice-es-ru' };
    if (s.kind === 'listen-type') return { ...s, kind: 'type' };
    return s;
  });
}

/**
 * Урок новых слов: знакомство + узнавание, пары, средний шаг (выбор/буквы/фраза),
 * в конце ввод с клавиатуры. От лёгкого к трудному.
 */
export function buildLearnSteps(words: Word[], pool: Word[], rng: Rng, opts: BuildOptions = {}): Step[] {
  const listening = opts.listening ?? true;
  const steps: Step[] = [];
  for (const w of words) {
    steps.push(makeStep('intro', w, pool, rng));
    steps.push(makeStep('choice-es-ru', w, pool, rng));
  }
  if (words.length >= 3) steps.push({ id: nextId(), kind: 'match', ...makeMatch(words, rng) });
  const middle: SingleKind[] = listening
    ? ['choice-ru-es', 'listen-choice', 'scramble', 'phrase']
    : ['choice-ru-es', 'scramble', 'phrase'];
  shuffle(words, rng).forEach((w, i) => steps.push(makeStep(middle[i % middle.length], w, pool, rng)));
  // Диктант по одному-двум словам перед вводом по переводу.
  if (listening) {
    for (const w of shuffle(words, rng).slice(0, words.length >= 4 ? 2 : 1)) {
      steps.push(makeStep('listen-type', w, pool, rng));
    }
  }
  for (const w of shuffle(words, rng)) steps.push(makeStep('type', w, pool, rng));
  return steps;
}

/** Тип упражнения для повторения зависит от того, насколько слово закрепилось. */
export function reviewKind(card: SrsCard | undefined, i: number, listening = true): SingleKind {
  const interval = card?.interval ?? 0;
  const fresh: SingleKind[] = ['choice-ru-es', 'scramble', 'choice-es-ru', 'listen-choice'];
  const middle: SingleKind[] = ['phrase', 'type', 'choice-ru-es', 'listen-type'];
  const pick = (list: SingleKind[]) => {
    const l = listening ? list : list.filter((k) => !k.startsWith('listen'));
    return l[i % l.length];
  };
  if (interval <= 1) return pick(fresh);
  if (interval < 7) return pick(middle);
  return listening && i % 4 === 3 ? 'listen-type' : 'type';
}

export function buildReviewSteps(
  words: Word[], cards: Record<string, SrsCard>, pool: Word[], rng: Rng, opts: BuildOptions = {},
): Step[] {
  const listening = opts.listening ?? true;
  const steps: Step[] = [];
  if (words.length >= 5) {
    // Самые трудные по FSRS — в «пары» в начале повторения.
    const weakest = words.slice().sort((a, b) => (cards[b.id]?.difficulty ?? 0) - (cards[a.id]?.difficulty ?? 0));
    steps.push({ id: nextId(), kind: 'match', ...makeMatch(weakest.slice(0, 5), rng) });
  }
  shuffle(words, rng).forEach((w, i) => steps.push(makeStep(reviewKind(cards[w.id], i, listening), w, pool, rng)));
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
    lower(grades, step.wordId, gradeFor(outcome.verdict, isTyped(step.kind)));
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
