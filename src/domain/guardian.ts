import type { GrammarExercise, Word } from '../content/schema';
import { shuffle, type Rng } from './generators';
import { toItem } from './grammar';
import { makeStep, type Step } from './lessonQueue';
import type { TrialItem, TrialsData } from './trial';

/**
 * Страж земли (задача 5.4): охраняет печать главы. Испытание — 20 заданий: упражнения всех уроков района, слова главы
 * и слова свитка земли. Порог 75%, после неудачи — попытка через сутки (те же правила, что у испытания места).
 * К стражу пускают, когда свиток земли выучен. Прохождения лежат в `meta.trials` под id `gd:<глава>`,
 * поэтому линия «Испытатель» считает и стражей.
 */

export const GUARDIAN_SIZE = 20;
export const GUARDIAN_PASS = 0.75;
/** Сколько в испытании упражнений грамматики, слов главы и слов свитка. */
export const GUARDIAN_MIX = { grammar: 12, words: 5, scroll: 3 };
/** Награда за победу над стражем. */
export const GUARDIAN_REWARD = { coins: 100 };

export const guardianId = (chapter: number) => `gd:${chapter}`;

export function parseGuardianId(id: string): number | null {
  const m = id.match(/^gd:(\d)$/);
  return m ? Number(m[1]) : null;
}

export const isGuardianDone = (records: TrialsData, chapter: number) => records[guardianId(chapter)]?.done !== undefined;

export const isGuardianPassed = (correct: number, almost: number, total: number) => total > 0 && (correct + almost) / total >= GUARDIAN_PASS;

/**
 * Задания стража: 12 упражнений грамматики из разных уроков района, 5 слов главы и 3 слова свитка, перемешаны.
 * Слова наполовину вводом, наполовину выбором; `listen` — слова на слух (страж леса слушает шёпоты).
 * Если чего-то не хватает (свитка нет), недостающее добирается грамматикой, потом словами.
 */
export function buildGuardian(
  exercises: GrammarExercise[], words: Word[], scroll: Word[], pool: Word[], rng: Rng, opts: { listen?: boolean } = {},
): TrialItem[] {
  // По одному упражнению из урока, пока хватает уроков: так испытание проходит по всему району.
  const byLesson = new Map<string, GrammarExercise[]>();
  for (const e of shuffle(exercises, rng)) {
    const l = e.id.slice(0, e.id.lastIndexOf('.'));
    byLesson.set(l, [...(byLesson.get(l) ?? []), e]);
  }
  const spread: GrammarExercise[] = [];
  for (let round = 0; spread.length < exercises.length; round++) {
    const next = shuffle([...byLesson.values()], rng).map((list) => list[round]).filter(Boolean);
    if (!next.length) break;
    spread.push(...next);
  }
  const sc = shuffle(scroll, rng).slice(0, GUARDIAN_MIX.scroll);
  const ws = shuffle(words, rng).slice(0, GUARDIAN_MIX.words + GUARDIAN_MIX.scroll - sc.length);
  const gr = spread.slice(0, GUARDIAN_SIZE - ws.length - sc.length);
  const wordKind = (i: number): Exclude<Step['kind'], 'match' | 'intro'> =>
    opts.listen ? (i % 2 ? 'listen-choice' : 'listen-type') : i % 2 ? 'choice-ru-es' : 'type';
  const items: TrialItem[] = [
    ...gr.map((e): TrialItem => ({ kind: 'grammar', item: toItem(e, rng) })),
    ...[...ws, ...sc].map((w, i): TrialItem => ({ kind: 'word', step: makeStep(wordKind(i), w, pool, rng) })),
  ];
  return shuffle(items, rng);
}
