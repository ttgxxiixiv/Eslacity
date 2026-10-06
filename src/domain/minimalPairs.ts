import type { Contrast, PairWord } from '../content/schema';
import { PAIR_PREFIX } from './itemId';
import { shuffle } from './generators';

/**
 * Звонница (задача 10.2): «Что вы услышали?». Звонарь произносит одно слово из пары похожих (pero — perro,
 * papa — papá, pala — palla), игрок выбирает, какое прозвучало. Сеть не нужна, но нужен звук.
 */

/** Заданий в одном звоне. */
export const BELLS_SIZE = 10;

export interface PairTask {
  contrast: string;
  /** Номер пары в противопоставлении. */
  pair: number;
  /** Какое слово звучит: 0 или 1. */
  target: 0 | 1;
  words: [PairWord, PairWord];
  /** Порядок кнопок: слова на экране не всегда в порядке файла. */
  order: [0 | 1, 0 | 1];
}

export const pairItemId = (contrast: string, pair: number): string => `${PAIR_PREFIX}${contrast}.${pair}`;

/**
 * Задания звона: пары выбранных противопоставлений по кругу, без повтора пары, пока они не кончились. Слово пары
 * и порядок кнопок случайные, поэтому угадать по месту нельзя.
 */
export function pairTasks(contrasts: Contrast[], n: number, rng: () => number): PairTask[] {
  const pool = shuffle(
    contrasts.flatMap((c) => c.pairs.map((words, pair) => ({ c, pair, words }))),
    rng,
  );
  const out: PairTask[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const { c, pair, words } = pool[i % pool.length];
    const target = rng() < 0.5 ? 0 : 1;
    out.push({ contrast: c.id, pair, target, words, order: rng() < 0.5 ? [0, 1] : [1, 0] });
  }
  return out;
}

/** Ответ: верно, если выбрано прозвучавшее слово. «Почти» здесь не бывает. */
export const pairVerdict = (task: PairTask, picked: 0 | 1): 'correct' | 'wrong' => (picked === task.target ? 'correct' : 'wrong');

/** Задание с ошибкой возвращается в конец звона с другим словом: та же пара, теперь звучит второе. */
export const retryTask = (task: PairTask): PairTask => ({ ...task, target: task.target === 0 ? 1 : 0 });

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** Чем пара не подходит своему противопоставлению; пусто — всё верно. */
export function pairIssue(c: Contrast, [a, b]: [PairWord, PairWord]): string | null {
  if (!a.es || !b.es || !a.ru || !b.ru) return 'пустое слово или перевод';
  if (a.es === b.es) return 'слова пары одинаковые';
  if (a.ru === b.ru) return 'одинаковый перевод';
  if (c.kind === 'swap') {
    const [from, to] = c.swap ?? ['', ''];
    if (!from) return 'у противопоставления swap нет поля swap';
    const k = a.es.indexOf(from);
    if (k < 0 || a.es.slice(0, k) + to + a.es.slice(k + from.length) !== b.es) return `второе слово не получается из первого заменой «${from}» на «${to}»`;
  } else if (c.kind === 'stress') {
    if (strip(a.es) !== strip(b.es)) return 'слова различаются не только ударением';
    if (strip(a.es) === a.es && strip(b.es) === b.es) return 'нет знака ударения';
  } else {
    const ok = [...a.es].some((ch, i) => i > 0 && a.es[i - 1] === ch && !'aeiouàèéìòù'.includes(ch) && a.es.slice(0, i) + a.es.slice(i + 1) === b.es);
    if (!ok) return 'второе слово не получается из первого заменой двойной согласной на одинарную';
  }
  return null;
}
