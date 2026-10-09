import type { GrammarExercise, GrammarLesson } from '../content/schema';
import { checkBuilt, checkForm, diagnose, type CheckResult, type Why } from './answer';
import { type Rng, shuffle } from './generators';
import { phraseTokens } from './phraseSteps';

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
  if (ex.kind === 'build' || (ex.kind === 'register' && !('options' in ex))) {
    return { id, ex, options: [], answer: -1, tiles: shuffle([...phraseTokens(ex.answer), ...ex.extra], rng), retry };
  }
  if (!('options' in ex)) return { id, ex, options: [], answer: -1, retry };
  const right = ex.options[ex.answer];
  const options = shuffle(ex.options, rng);
  return { id, ex, options, answer: options.indexOf(right), retry };
}

/**
 * Порядок: сначала узнавание (выбор формы, пропуски, верно/неверно, смысл, регистр), потом сборка,
 * потом ввод (форма, ошибка, текст с пропусками, пересказ, связка). Внутри группы перемешано.
 */
const QUEUE_ORDER: Record<GrammarExercise['kind'], number> = {
  choose: 0, gap: 1, truefalse: 2, paraphrase: 3, register: 4, build: 5, type: 6, fix: 7, cloze: 8, transform: 9, combine: 10,
};

/** Задания с вводом с клавиатуры: в испытаниях над полем только буквы с ударением. */
export const TYPED_KINDS: ReadonlySet<GrammarExercise['kind']> = new Set(['type', 'fix', 'cloze', 'transform', 'combine']);

export function buildGrammarQueue(exercises: GrammarExercise[], rng: Rng): GrammarItem[] {
  const order = QUEUE_ORDER;
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

/**
 * Ответ на упражнение: номер варианта, вписанная форма или фраза, плитки в порядке сборки,
 * формы для каждого пропуска текста (cloze) или номер слова с ошибкой и его верная форма (fix).
 */
export type GrammarInput = { pick: number } | { text: string } | { tiles: string[] } | { texts: string[] } | { at: number; text: string };

export interface GrammarCheck extends CheckResult {
  /** Что показать как правильный ответ: предложение с формой, собранное предложение или вариант. */
  shown?: string;
  /** Что произнести после верного ответа. */
  speak?: string;
}

/** Предложение с пропуском, заполненное формой. */
export const fillGap = (sentence: string, word: string) => sentence.replace('___', word);

/** Текст с несколькими пропусками, заполненный формами по порядку. В начале предложения форма с заглавной. */
export function fillGaps(text: string, words: string[]): string {
  return text.split('___').reduce((acc, part, i) => {
    if (!i) return part;
    const w = words[i - 1] ?? '___';
    const start = !acc.trim() || /[.!?]\s*$/.test(acc);
    return acc + (start ? w.charAt(0).toUpperCase() + w.slice(1) : w) + part;
  }, '');
}

/** Слова предложения для задания «найди ошибку»: по пробелам, знаки остаются при слове. */
export const fixWords = (sentence: string) => sentence.trim().split(/\s+/);

/** Предложение, где слово с ошибкой заменено верной формой (знаки препинания вокруг слова сохраняются). */
export function fixSentence(sentence: string, at: number, form: string): string {
  return fixWords(sentence)
    .map((w, i) => (i === at ? w.replace(/[\p{L}'’]+/u, form) : w))
    .join(' ');
}

/** Худший итог из нескольких: одна ошибка — неверно, одно ударение — почти. */
const worst = (vs: CheckResult[]): CheckResult['verdict'] =>
  vs.some((v) => v.verdict === 'wrong') ? 'wrong' : vs.some((v) => v.verdict === 'almost') ? 'almost' : 'correct';

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
  // Пересказ и связка: целая фраза, как форма — регистр и знаки не важны, без ударения «почти», опечатки не прощаются.
  if (ex.kind === 'transform' || ex.kind === 'combine') {
    const r = checkForm('text' in input ? input.text : '', [ex.answer, ...(ex.alt ?? [])]);
    return { ...r, shown: ex.answer, speak: ex.answer };
  }
  if (ex.kind === 'cloze') {
    const texts = 'texts' in input ? input.texts : [];
    const each = ex.answers.map((acc, i) => checkForm(texts[i] ?? '', acc));
    const full = fillGaps(ex.text, ex.answers.map((a) => a[0]));
    const verdict = worst(each);
    return { verdict, expected: full, reason: verdict === 'almost' ? 'accent' : undefined, shown: full, speak: full };
  }
  if (ex.kind === 'fix') {
    const full = fixSentence(ex.sentence, ex.wrong, ex.answer);
    // Не то слово — неверно, даже если форма вписана правильно.
    if (!('at' in input) || input.at !== ex.wrong) return { verdict: 'wrong', expected: ex.answer, shown: full, speak: full };
    const r = checkForm(input.text, [ex.answer, ...(ex.alt ?? [])]);
    return { ...r, shown: full, speak: full };
  }
  if (ex.kind === 'register' && !('options' in ex)) {
    const r = checkBuilt('tiles' in input ? input.tiles : [], [ex.answer, ...(ex.alt ?? [])]);
    return { ...r, shown: ex.answer, speak: ex.answer };
  }
  const i = 'pick' in input ? input.pick : -1;
  const right = item.options[item.answer];
  const verdict = i === item.answer ? 'correct' : 'wrong';
  if (ex.kind === 'truefalse') return { verdict, expected: right };
  if (!('options' in ex)) return { verdict: 'wrong', expected: right };
  const shown = ex.kind === 'gap' ? fillGap(ex.sentence, right) : right;
  return { verdict, expected: right, shown, speak: shown };
}

/** Заголовок итога: «Верно!», «Почти» (ударение), «Неверно» или «Неверно, правильно: верно». */
export function grammarTitle(item: GrammarItem, c: GrammarCheck): string {
  if (c.verdict === 'correct') return 'Верно!';
  if (c.verdict === 'almost') return 'Почти';
  return item.ex.kind === 'truefalse' ? `Неверно, правильно: ${c.expected.toLowerCase()}` : 'Неверно';
}

/** Ячейка таблицы годится как форма, если это короткая форма, а не пример или пояснение. */
const formCell = (s: string) => !!s && s.length <= 25 && !/[()/=…,.;:?!¿¡\p{Script=Cyrillic}]/u.test(s) && s.trim().split(/\s+/).length <= 3;

/**
 * Формы из таблиц теории урока с подписью по строке и столбцу: «soy» — «yo · ser» (задача 12.3).
 * Первый столбец — подписи строк, формой он не считается.
 */
export function tableForms(theory: GrammarLesson['theory']): { form: string; label: string }[] {
  const out: { form: string; label: string }[] = [];
  for (const b of theory) {
    if (b.kind !== 'table') continue;
    for (const r of b.rows) {
      r.cells.forEach((cell, c) => {
        if (c === 0 || !formCell(cell)) return;
        const label = [r.cells[0], b.head[c]].filter((x) => x && x.length <= 25 && x !== cell).join(' · ');
        if (label) out.push({ form: cell, label });
      });
    }
  }
  return out;
}

/**
 * Причина ошибки в упражнении грамматики: только для ввода формы и выбора варианта. Формы — из таблиц
 * урока; опечатка не называется (одна буква в форме — уже другая форма).
 */
export function diagnoseGrammar(item: GrammarItem, input: GrammarInput, c: GrammarCheck, forms: { form: string; label: string }[] = []): Why | undefined {
  if (c.verdict === 'correct') return undefined;
  const { ex } = item;
  const ctx = { forms, typos: false };
  if ((ex.kind === 'type' || ex.kind === 'transform' || ex.kind === 'combine') && 'text' in input) {
    return diagnose(input.text, [ex.answer, ...(ex.alt ?? [])], ctx);
  }
  if (ex.kind === 'fix' && 'at' in input && input.at === ex.wrong) return diagnose(input.text, [ex.answer, ...(ex.alt ?? [])], ctx);
  if ((ex.kind === 'choose' || ex.kind === 'gap') && 'pick' in input && input.pick >= 0) {
    return diagnose(item.options[input.pick], [item.options[item.answer]], ctx);
  }
  return undefined;
}
