import type { Mission, MissionAnswer, Phrase } from '../content/schema';
import { checkPhrase, normalize, type Verdict } from './answer';
import { phraseTokens } from './phraseSteps';
import { shuffle, type Rng } from './generators';

/**
 * Сюжетная миссия (задача 4.5): граф узлов — реплики жителя и ответы героя с ветками. Режим ответа растёт
 * с каждым прохождением: в первый раз герой выбирает фразу, во второй собирает из плиток, дальше пишет сам.
 * Неверный ответ — смешная реакция жителя и подсказка, диалог идёт дальше по основной ветке.
 */

export type MissionMode = 'choose' | 'tiles' | 'type';

/** Доля верных ответов героя, с которой миссия засчитана. */
export const MISSION_PASS = 0.8;

/** Режим по номеру прохождения (с 1): выбор, сборка, дальше ввод. */
export function modeForAttempt(attempt: number): MissionMode {
  return attempt <= 1 ? 'choose' : attempt === 2 ? 'tiles' : 'type';
}

export const isPassed = (correct: number, answered: number) => answered > 0 && correct / answered >= MISSION_PASS;

export type HeroAnswer = { kind: 'pick'; phrase: string } | { kind: 'text'; text: string };

export interface AnswerResult {
  verdict: Verdict;
  /** Куда идёт диалог. */
  next: string;
  /** Какая фраза засчитана (или основная при ошибке). */
  phrase: string;
}

/**
 * Ответ героя на узел. Выбор верен, если выбрана фраза одной из веток. Текст (плитки или ввод) сверяется со всеми
 * ветками через `checkPhrase`: «почти» тоже засчитывается — житель понял. Ошибка ведёт по основной ветке.
 */
export function answerNode(node: MissionAnswer, a: HeroAnswer, phrases: Record<string, Phrase>): AnswerResult {
  const main = node.branches[0];
  if (a.kind === 'pick') {
    const hit = node.branches.find((b) => b.phrase === a.phrase);
    return hit ? { verdict: 'correct', next: hit.next, phrase: hit.phrase } : { verdict: 'wrong', next: main.next, phrase: main.phrase };
  }
  let best: AnswerResult = { verdict: 'wrong', next: main.next, phrase: main.phrase };
  for (const b of node.branches) {
    const p = phrases[b.phrase];
    if (!p) continue;
    const v = checkPhrase(a.text, p).verdict;
    if (v === 'correct') return { verdict: v, next: b.next, phrase: b.phrase };
    if (v === 'almost' && best.verdict === 'wrong') best = { verdict: v, next: b.next, phrase: b.phrase };
  }
  return best;
}

/**
 * Варианты для выбора: фразы веток и другие фразы места до четырёх. Ловушка не должна быть тоже верным ответом:
 * фразы, которые делят с ветками ключевое слово («café» в «Un café con hielo» при задаче заказать кофе), не берутся.
 * Ключевое — слово от четырёх букв, которое встречается не больше чем в двух фразах места («favor» есть везде).
 */
export function missionOptions(node: MissionAnswer, pool: Phrase[], rng: Rng): string[] {
  const own = node.branches.map((b) => b.phrase);
  const words = (p: Phrase) => new Set(phraseTokens(p.es).map((t) => normalize(t)).filter((t) => t.length >= 4));
  const freq = new Map<string, number>();
  for (const p of pool) for (const w of words(p)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const keys = new Set(pool.filter((p) => own.includes(p.id)).flatMap((p) => [...words(p)].filter((w) => (freq.get(w) ?? 0) <= 2)));
  const others = shuffle(pool.filter((p) => !own.includes(p.id) && ![...words(p)].some((w) => keys.has(w))), rng).slice(0, Math.max(0, 4 - own.length));
  return shuffle([...own, ...others.map((p) => p.id)], rng);
}

/**
 * Ошибки графа: нет стартового узла, ссылка на несуществующий узел, недостижимый узел, цикл, нет конца,
 * у ответа нет веток. Для валидатора.
 */
export function missionGraphIssues(m: Mission): string[] {
  const out: string[] = [];
  const nodes = m.nodes ?? {};
  if (!nodes[m.start]) return [`нет стартового узла "${m.start}"`];
  const edges = (id: string): string[] => {
    const n = nodes[id];
    if (!n) return [];
    return n.kind === 'say' ? (n.next ? [n.next] : []) : n.branches.map((b) => b.next);
  };
  for (const [id, n] of Object.entries(nodes)) {
    if (n.kind === 'answer' && !n.branches?.length) out.push(`у ответа "${id}" нет веток`);
    for (const to of edges(id)) if (!nodes[to]) out.push(`узел "${id}" ведёт в несуществующий "${to}"`);
  }
  // Обход в глубину: достижимость и циклы.
  const state = new Map<string, 'open' | 'done'>();
  let ends = 0;
  const visit = (id: string) => {
    if (state.get(id) === 'done' || !nodes[id]) return;
    if (state.get(id) === 'open') {
      out.push(`цикл через "${id}"`);
      return;
    }
    state.set(id, 'open');
    const next = edges(id);
    if (!next.length) ends++;
    next.forEach(visit);
    state.set(id, 'done');
  };
  visit(m.start);
  for (const id of Object.keys(nodes)) if (!state.has(id)) out.push(`узел "${id}" недостижим`);
  if (!ends) out.push('диалог не заканчивается');
  return out;
}

/** Самый длинный путь по ответам героя: сколько ответов в миссии (для подсказки «ответов: 5»). */
export function answersOnPath(m: Mission): number {
  const memo = new Map<string, number>();
  const walk = (id: string | undefined): number => {
    if (!id || !m.nodes[id]) return 0;
    if (memo.has(id)) return memo.get(id)!;
    memo.set(id, 0);
    const n = m.nodes[id];
    const r = n.kind === 'say' ? walk(n.next) : 1 + Math.max(...n.branches.map((b) => walk(b.next)));
    memo.set(id, r);
    return r;
  };
  return walk(m.start);
}

/** Награда за первое прохождение: монеты и очки отношений с жителем. */
export const MISSION_REWARD = { coins: 30, rep: 2 };
