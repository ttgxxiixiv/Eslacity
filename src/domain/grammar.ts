import type { GrammarExercise, GrammarLesson, TheoryBlock } from '../content/schema';
import { checkBuilt, checkForm, type CheckResult } from './answer';
import { type Rng, shuffle } from './generators';
import { phraseTokens } from './phraseSteps';

/** Убрать строки таблиц и упражнения с vosotros, если вариант их не использует. */
export function forVariant(lesson: GrammarLesson, vosotros: boolean): GrammarLesson {
  if (vosotros) return lesson;
  const theory: TheoryBlock[] = [];
  for (const b of lesson.theory) {
    if (b.kind !== 'table') {
      theory.push(b);
      continue;
    }
    const rows = b.rows.filter((r) => r.region !== 'es');
    if (rows.length) theory.push({ ...b, rows });
  }
  return { ...lesson, theory, exercises: lesson.exercises.filter((e) => e.region !== 'es') };
}

export interface GrammarItem {
  id: string;
  ex: GrammarExercise;
  /** Варианты в случайном порядке и индекс правильного (для верно/неверно не нужны). Для сборки и ввода пусто, answer −1. */
  options: string[];
  answer: number;
  /** Плитки для сборки: слова ответа и лишние, перемешаны. */
  tiles?: string[];
  retry?: boolean;
}

let seq = 0;

export function toItem(ex: GrammarExercise, rng: Rng, retry = false): GrammarItem {
  const id = `g${++seq}`;
  if (ex.kind === 'truefalse') return { id, ex, options: ['Верно', 'Неверно'], answer: ex.answer ? 0 : 1, retry };
  if (ex.kind === 'build') return { id, ex, options: [], answer: -1, tiles: shuffle([...phraseTokens(ex.answer), ...ex.extra], rng), retry };
  if (ex.kind === 'type') return { id, ex, options: [], answer: -1, retry };
  const right = ex.options[ex.answer];
  const options = shuffle(ex.options, rng);
  return { id, ex, options, answer: options.indexOf(right), retry };
}

/** Порядок: выбор формы → пропуски → верно/неверно → сборка → ввод формы, внутри группы перемешано. */
export function buildGrammarQueue(exercises: GrammarExercise[], rng: Rng): GrammarItem[] {
  const order = { choose: 0, gap: 1, truefalse: 2, build: 3, type: 4 };
  return shuffle(exercises, rng)
    .sort((a, b) => order[a.kind] - order[b.kind])
    .map((e) => toItem(e, rng));
}

export interface GrammarRun {
  queue: GrammarItem[];
  index: number;
  firstTry: number;
  total: number;
}

export function startGrammar(queue: GrammarItem[]): GrammarRun {
  return { queue, index: 0, firstTry: 0, total: queue.length };
}

/** Ошибка возвращает задание в конец (один раз). В счёт идут только первые попытки. */
export function answerGrammar(run: GrammarRun, correct: boolean, rng: Rng): GrammarRun {
  const item = run.queue[run.index];
  const next = { ...run };
  if (correct && !item.retry) next.firstTry++;
  if (!correct && !item.retry) next.queue = [...run.queue, toItem(item.ex, rng, true)];
  return next;
}

export function grammarScore(run: GrammarRun): number {
  return run.total ? Math.round((run.firstTry / run.total) * 100) : 0;
}

/** Сколько упражнений урока держать в повторении. */
export const RULES_PER_LESSON = 3;

/**
 * Какие упражнения урока попадают в повторение и с какой оценкой: все, где ошиблись с первой попытки
 * (оценка 1, вернутся завтра), и случайные верные, пока у урока не наберётся три карточки (оценка 4).
 * `already` — упражнения урока, у которых карточка уже есть: при повторном прохождении урока случайные
 * не добавляются сверх трёх и не берутся из уже повторяемых.
 */
export function rulesForReview(
  exercises: GrammarExercise[], wrong: ReadonlySet<string>, already: ReadonlySet<string>, rng: Rng,
): { exerciseId: string; grade: 1 | 4 }[] {
  const out: { exerciseId: string; grade: 1 | 4 }[] = exercises.filter((e) => wrong.has(e.id)).map((e) => ({ exerciseId: e.id, grade: 1 }));
  const room = RULES_PER_LESSON - new Set([...already, ...wrong]).size;
  if (room > 0) {
    const rest = shuffle(exercises.filter((e) => !wrong.has(e.id) && !already.has(e.id)), rng).slice(0, room);
    out.push(...rest.map((e) => ({ exerciseId: e.id, grade: 4 as const })));
  }
  return out;
}

/** Ответ на упражнение: номер варианта, вписанная форма или плитки в порядке сборки. */
export type GrammarInput = { pick: number } | { text: string } | { tiles: string[] };

export interface GrammarCheck extends CheckResult {
  /** Что показать как правильный ответ: предложение с формой, собранное предложение или вариант. */
  shown?: string;
  /** Что произнести после верного ответа. */
  speak?: string;
}

/** Предложение с пропуском, заполненное формой. */
export const fillGap = (sentence: string, word: string) => sentence.replace('___', word);

/** Проверка ответа на любое упражнение грамматики. «Почти» бывает только у ввода формы (без ударения). */
export function checkGrammar(item: GrammarItem, input: GrammarInput): GrammarCheck {
  const { ex } = item;
  if (ex.kind === 'build') {
    const r = checkBuilt('tiles' in input ? input.tiles : [], [ex.answer, ...(ex.alt ?? [])]);
    return { ...r, shown: ex.answer, speak: ex.answer };
  }
  if (ex.kind === 'type') {
    const r = checkForm('text' in input ? input.text : '', [ex.answer, ...(ex.alt ?? [])]);
    const full = fillGap(ex.sentence, ex.answer);
    return { ...r, shown: full, speak: full };
  }
  const i = 'pick' in input ? input.pick : -1;
  const right = item.options[item.answer];
  const verdict = i === item.answer ? 'correct' : 'wrong';
  if (ex.kind === 'truefalse') return { verdict, expected: right };
  const shown = ex.kind === 'gap' ? fillGap(ex.sentence, right) : right;
  return { verdict, expected: right, shown, speak: shown };
}

/** Заголовок итога: «Верно!», «Почти» (ударение), «Неверно» или «Неверно, правильно: верно». */
export function grammarTitle(item: GrammarItem, c: GrammarCheck): string {
  if (c.verdict === 'correct') return 'Верно!';
  if (c.verdict === 'almost') return 'Почти';
  return item.ex.kind === 'truefalse' ? `Неверно, правильно: ${c.expected.toLowerCase()}` : 'Неверно';
}
