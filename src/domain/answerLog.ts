import type { Verdict } from './answer';

/**
 * Журнал ответов: каждая попытка в любом задании. По нему считаются точность, медали,
 * сила Эликсира и отчёты. Записи хранятся только на устройстве.
 */
export type AnswerMode = 'learn' | 'practice' | 'review' | 'grammar' | 'blitz';

export interface AnswerRecord {
  id?: number;
  ts: number;
  /** Слово (`cafe.te`) или упражнение грамматики (`g:a1.02-ser.3`). */
  itemId: string;
  /** Вид задания: `type`, `listen-choice`, `grammar-gap`, `blitz-ru-es` и т. д. */
  kind: string;
  verdict: Verdict;
  mode: AnswerMode;
  /** Время на ответ, мс. */
  ms: number;
}

const DAY = 86_400_000;
export const LOG_KEEP_DAYS = 90;
export const LOG_MAX_ROWS = 20_000;
/** Дольше этого время ответа не учитываем: человек отвлёкся. */
const MAX_MS = 10 * 60_000;

/** Записи старше этого момента удаляются. */
export function keepSince(now: number): number {
  return now - LOG_KEEP_DAYS * DAY;
}

export function answerMs(shownAt: number, now: number): number {
  return Math.max(0, Math.min(MAX_MS, Math.round(now - shownAt)));
}

/**
 * Запись упражнения грамматики в журнале: `g:` и устойчивый id из контента (`a1.02-ser.3`).
 * До версии 2.14.0 номер брался по порядку в файле — id в контенте проставлены по тому же правилу, записи совпадают.
 */
export function grammarItemId(exerciseId: string): string {
  return `g:${exerciseId}`;
}

export interface AnswerSummary {
  total: number;
  correct: number;
  almost: number;
  wrong: number;
  /** Доля верных с первого раза, «почти» считается как половина. null, если ответов нет. */
  accuracy: number | null;
}

export function summarize(rows: Iterable<AnswerRecord>, since = -Infinity): AnswerSummary {
  const s = { total: 0, correct: 0, almost: 0, wrong: 0 };
  for (const r of rows) {
    if (r.ts < since) continue;
    s.total++;
    s[r.verdict]++;
  }
  return { ...s, accuracy: s.total ? (s.correct + s.almost / 2) / s.total : null };
}

export function byKind(rows: Iterable<AnswerRecord>, since = -Infinity): Record<string, AnswerSummary> {
  const groups: Record<string, AnswerRecord[]> = {};
  for (const r of rows) (groups[r.kind] ??= []).push(r);
  return Object.fromEntries(Object.entries(groups).map(([k, list]) => [k, summarize(list, since)]));
}

/** Задания на слух: для медали «Слушатель» и навыка «Слух». */
export function isListening(kind: string): boolean {
  return kind.startsWith('listen');
}
