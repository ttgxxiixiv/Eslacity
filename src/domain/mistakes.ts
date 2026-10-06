import type { WhyKind } from './answer';
import { type AnswerRecord, type AnswerSummary, isListening, summarize } from './answerLog';
import { isPhraseId, isRuleId, isWordId } from './itemId';
import type { StepKind } from './lessonQueue';

/**
 * Работа над ошибками по журналу ответов (задача 12.2). Чистые функции: журнал передаётся снаружи.
 * Слабые места — карточки, где игрок ошибался, отвечал «почти» или думал заметно дольше обычного за последние
 * 30 дней, кроме уже исправленных. По ним Летописец раз в день даёт поручение «Разбор ошибок».
 * Причины ошибок (12.3) и навыки (на слух, ввод, выбор) — для экрана «Мой путь» (14.5).
 */

const DAY = 86_400_000;
/** Журнал смотрим за столько дней. */
export const MISTAKES_DAYS = 30;
/** Заданий в «Разборе ошибок». */
export const MISTAKES_SIZE = 10;
/** Меньше стольких слабых мест поручения нет: разбирать нечего. */
export const MISTAKES_FLOOR = 4;
/** Ответ медленный, если он дольше обычного для этого вида задания во столько раз и не короче 6 секунд. */
const SLOW_FACTOR = 2;
const SLOW_MIN_MS = 6000;

/** Просьба Летописца: {n} — число заданий. */
export const MISTAKES_TEXT = 'Путник, я записываю всё, где ты оступался. Разберём {n} {мест}, пока ошибки не стали привычкой.';

export interface WeakItem {
  itemId: string;
  wrong: number;
  almost: number;
  slow: number;
  /** Вид задания, где ошибались чаще всего: в нём и разбирать. */
  kind: string;
  score: number;
  /** Когда был последний ответ. */
  last: number;
}

/** Разбираются карточки слов, правил и фраз: формы кузницы и пары Звонницы повторяются у мастеров. */
const reviewable = (id: string) => isWordId(id) || isRuleId(id) || isPhraseId(id);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[(s.length - 1) >> 1] : 0;
}

/** Обычное время ответа по виду задания: медиана верных ответов. */
function usualMs(rows: AnswerRecord[]): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const r of rows) if (r.verdict === 'correct') by.set(r.kind, [...(by.get(r.kind) ?? []), r.ms]);
  return new Map([...by].map(([k, v]) => [k, median(v)]));
}

/**
 * Слабые места: самые частые ошибки сверху. `exists` — есть ли у игрока карточка (журнал помнит и удалённые).
 * Исправленное (два последних ответа верны и не медленные) не берётся.
 */
export function weakItems(rows: AnswerRecord[], now: number, exists: (id: string) => boolean = () => true): WeakItem[] {
  const recent = rows.filter((r) => r.ts >= now - MISTAKES_DAYS * DAY && reviewable(r.itemId) && exists(r.itemId));
  const usual = usualMs(recent);
  const isSlow = (r: AnswerRecord) => r.verdict !== 'wrong' && r.ms >= SLOW_MIN_MS && r.ms > SLOW_FACTOR * (usual.get(r.kind) ?? Infinity);
  const groups = new Map<string, AnswerRecord[]>();
  for (const r of recent) groups.set(r.itemId, [...(groups.get(r.itemId) ?? []), r]);
  const out: WeakItem[] = [];
  for (const [itemId, list] of groups) {
    list.sort((a, b) => a.ts - b.ts);
    const tail = list.slice(-2);
    if (tail.length === 2 && tail.every((r) => r.verdict === 'correct' && !isSlow(r))) continue;
    const bad = list.filter((r) => r.verdict !== 'correct' || isSlow(r));
    if (!bad.length) continue;
    const wrong = bad.filter((r) => r.verdict === 'wrong').length;
    const almost = bad.filter((r) => r.verdict === 'almost').length;
    const slow = bad.filter(isSlow).length;
    // Вид, где ошибались чаще; при равенстве — последний.
    const counts = new Map<string, number>();
    for (const r of bad) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    const kind = [...counts].reduce((best, k) => (k[1] >= best[1] ? k : best))[0];
    out.push({ itemId, wrong, almost, slow, kind, score: 2 * wrong + almost + 0.5 * slow, last: list[list.length - 1].ts });
  }
  return out.sort((a, b) => b.score - a.score || b.last - a.last);
}

/** Причины ошибок за период: сколько раз каждая (задача 12.3 пишет их в журнал). */
export function whyCounts(rows: Iterable<AnswerRecord>, since = -Infinity): Partial<Record<WhyKind, number>> {
  const out: Partial<Record<WhyKind, number>> = {};
  for (const r of rows) if (r.ts >= since && r.why && r.verdict !== 'correct') out[r.why] = (out[r.why] ?? 0) + 1;
  return out;
}

export type Skill = 'listen' | 'type' | 'choice';

/** Ввод с клавиатуры: слова, фразы, формы грамматики и кузницы, задания C1 с вводом. */
const TYPED = /(^|-)(type|transform|fix|cloze|combine)$|^forge-/;

/** Навык задания: на слух, ввод или выбор (всё остальное — выбор, сборка, пары). */
export function skillOf(kind: string): Skill {
  if (isListening(kind)) return 'listen';
  return TYPED.test(kind) ? 'type' : 'choice';
}

/** Точность по навыкам за период. */
export function skillStats(rows: Iterable<AnswerRecord>, since = -Infinity): Record<Skill, AnswerSummary> {
  const by: Record<Skill, AnswerRecord[]> = { listen: [], type: [], choice: [] };
  for (const r of rows) if (r.ts >= since) by[skillOf(r.kind)].push(r);
  return { listen: summarize(by.listen), type: summarize(by.type), choice: summarize(by.choice) };
}

/** Виды заданий слов, которые можно задать прямо. «Пары» и знакомство — нет: тогда выбор перевода. */
const WORD_KINDS = new Set<string>(['choice-es-ru', 'choice-ru-es', 'scramble', 'phrase', 'type', 'listen-choice', 'listen-type']);

export interface MistakesPlan {
  words: string[];
  rules: string[];
  phrases: string[];
  /** Вид задания для слова: тот, где ошибались. */
  kinds: Record<string, StepKind>;
}

/** «Разбор ошибок»: десять самых слабых мест или ничего, если их меньше четырёх. */
export function mistakesPlan(weak: WeakItem[]): MistakesPlan | null {
  const top = weak.slice(0, MISTAKES_SIZE);
  if (top.length < MISTAKES_FLOOR) return null;
  const words = top.filter((w) => isWordId(w.itemId));
  return {
    words: words.map((w) => w.itemId),
    rules: top.filter((w) => isRuleId(w.itemId)).map((w) => w.itemId),
    phrases: top.filter((w) => isPhraseId(w.itemId)).map((w) => w.itemId),
    kinds: Object.fromEntries(words.map((w) => [w.itemId, (WORD_KINDS.has(w.kind) ? w.kind : 'choice-es-ru') as StepKind])),
  };
}
