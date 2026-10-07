import type { ThreadNote, ThreadTrigger } from '../content/schema';
import { dayKey } from './srs';

/**
 * Нить главы (задача 13.1). Истории жителей разложены по двадцати миссиям, а Летописец сводит их в одну:
 * у каждой главы три его сцены. Пролог — когда глава открыта, середина — 10 обрывков главы, кульминация —
 * 20 обрывков, перед стражем. Кульминация ставит вопрос, ответ на который будет в следующей главе.
 * Если за день добыт обрывок, Летописец оставляет записку.
 */

export const THREAD_TRIGGERS: readonly ThreadTrigger[] = ['open', 'half', 'climax'];
/** Сколько обрывков главы нужно для сцены. */
export const THREAD_AT: Record<ThreadTrigger, number> = { open: 0, half: 10, climax: 20 };
export const TRIGGER_LABEL: Record<ThreadTrigger, string> = { open: 'Начало главы', half: 'Середина пути', climax: 'Перед стражем' };
/** «Место» сцен нити: файл `scenes/thread.json`, говорит Летописец. */
export const THREAD_PLACE = 'thread';
/** Главы, у которых уже написана нить: валидатор требует у них все три сцены. Растёт по главе за версию. */
export const THREAD_CHAPTERS = [1, 2, 3];
/** Записок у главы не меньше стольких: чтобы не повторялись день за днём. */
export const THREAD_NOTES_MIN = 6;

export const threadId = (chapter: number, trigger: ThreadTrigger) => `th:${chapter}.${trigger}`;
export const isThreadId = (id: string) => id.startsWith('th:');

/** `th:1.half` → глава и момент; не сцена нити — null. */
export function parseThreadId(id: string): { chapter: number; trigger: ThreadTrigger } | null {
  const m = id.match(/^th:(\d+)\.(\w+)$/);
  if (!m || !THREAD_TRIGGERS.includes(m[2] as ThreadTrigger)) return null;
  return { chapter: Number(m[1]), trigger: m[2] as ThreadTrigger };
}

export interface ThreadRecord {
  /** id сцены → когда прочитана. */
  seen: Record<string, number>;
  /** День (`dayKey`), когда прочитана записка. */
  note?: string;
}

export const EMPTY_THREAD: ThreadRecord = { seen: {} };

/** Обрывки главы из записи пути: ключи `<глава>:<место>`. */
export function fragmentsOf(fragments: Record<string, number>, chapter: number): number {
  return Object.keys(fragments).filter((k) => k.startsWith(`${chapter}:`)).length;
}

/**
 * Сцены нити, которые уже открыты: главы до открытой включительно, по числу обрывков главы. `exists` — есть ли
 * сцена в контенте (нить пишется по главам). По порядку глав и моментов.
 */
export function openThread(opened: number, fragments: Record<string, number>, exists: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (let ch = 1; ch <= opened; ch++) {
    const got = fragmentsOf(fragments, ch);
    for (const t of THREAD_TRIGGERS) if (got >= THREAD_AT[t] && exists(threadId(ch, t))) out.push(threadId(ch, t));
  }
  return out;
}

/** Открытые и ещё не прочитанные сцены нити. */
export function threadDue(opened: number, fragments: Record<string, number>, rec: ThreadRecord, exists: (id: string) => boolean): string[] {
  return openThread(opened, fragments, exists).filter((id) => rec.seen[id] === undefined);
}

/** Обрывки, добытые сегодня. */
export function shardsToday(fragments: Record<string, number>, now: number): number {
  const today = dayKey(now);
  return Object.values(fragments).filter((ts) => dayKey(ts) === today).length;
}

/** Записка ждёт: сегодня добыт обрывок, а записку сегодня ещё не читали. */
export function noteDue(fragments: Record<string, number>, rec: ThreadRecord, now: number): boolean {
  return shardsToday(fragments, now) > 0 && rec.note !== dayKey(now);
}

/** Записка дня: своя на каждый день, из записок открытой главы (если их нет — ближайшей прошлой). */
export function noteOf(notes: Record<string, ThreadNote[]>, opened: number, now: number): ThreadNote | null {
  for (let ch = opened; ch >= 1; ch--) {
    const list = notes[String(ch)] ?? [];
    if (!list.length) continue;
    // Номер дня по местной дате: записка меняется в полночь, как и день в `dayKey`.
    const [y, m, d] = dayKey(now).split('-').map(Number);
    return list[Math.round(Date.UTC(y, m - 1, d) / 86_400_000) % list.length];
  }
  return null;
}
