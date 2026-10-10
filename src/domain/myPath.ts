import { type AnswerRecord, type AnswerSummary, summarize } from './answerLog';
import { isRuleId } from './itemId';
import { SOLID_INTERVAL_DAYS } from './medals';
import { skillOf } from './mistakes';
import { dayKey } from './srs';

/**
 * Экран «Мой путь» (задача 14.5): точность по навыкам, время в заданиях по дням, слова по главам.
 * Чистые функции, журнал ответов и карточки передаются снаружи.
 */

const DAY = 86_400_000;

export type PathSkill = 'listen' | 'type' | 'choice' | 'grammar';

export const PATH_SKILLS: { id: PathSkill; title: string }[] = [
  { id: 'listen', title: 'Слух' },
  { id: 'type', title: 'Ввод' },
  { id: 'choice', title: 'Выбор' },
  { id: 'grammar', title: 'Грамматика' },
];

/** Навык ответа: правила грамматики отдельно, остальное — по виду задания (слух, ввод, выбор). */
export const pathSkillOf = (r: Pick<AnswerRecord, 'itemId' | 'kind'>): PathSkill => (isRuleId(r.itemId) ? 'grammar' : skillOf(r.kind));

/** Точность по навыкам за последние `days` дней. */
export function pathAccuracy(rows: Iterable<AnswerRecord>, now: number, days: number): Record<PathSkill, AnswerSummary> {
  const since = now - days * DAY;
  const by: Record<PathSkill, AnswerRecord[]> = { listen: [], type: [], choice: [], grammar: [] };
  for (const r of rows) if (r.ts >= since) by[pathSkillOf(r)].push(r);
  return { listen: summarize(by.listen), type: summarize(by.type), choice: summarize(by.choice), grammar: summarize(by.grammar) };
}

/** Один ответ дольше этого считаем как это время: человек отвлёкся, а не думал. */
export const ACTIVE_MS_CAP = 2 * 60_000;

/** Минуты в заданиях по дням, от старого к сегодняшнему: время ответов из журнала. */
export function minutesPerDay(rows: Iterable<AnswerRecord>, now: number, days: number): { key: string; minutes: number }[] {
  const keys = Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * DAY));
  const ms = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const k = dayKey(r.ts);
    if (ms.has(k)) ms.set(k, ms.get(k)! + Math.min(r.ms, ACTIVE_MS_CAP));
  }
  return keys.map((key) => ({ key, minutes: Math.round(ms.get(key)! / 60_000) }));
}

export interface ChapterWords {
  chapter: number;
  total: number;
  learned: number;
  solid: number;
}

/**
 * Слова по главам: всего в контенте, выучено (есть карточка) и закреплено (стабильность не меньше 21 дня,
 * как в словарном запасе). `chapterOf` — глава слова или undefined, если слово в запас не входит.
 */
export function wordsByChapter(
  ids: Iterable<string>,
  chapterOf: (id: string) => number | undefined,
  cards: Record<string, { stability?: number; interval: number }>,
  chapters: number[],
): ChapterWords[] {
  const rows = new Map(chapters.map((c) => [c, { chapter: c, total: 0, learned: 0, solid: 0 }]));
  for (const id of ids) {
    const row = rows.get(chapterOf(id) ?? 0);
    if (!row) continue;
    row.total++;
    const card = cards[id];
    if (!card) continue;
    row.learned++;
    if ((card.stability ?? card.interval) >= SOLID_INTERVAL_DAYS) row.solid++;
  }
  return [...rows.values()];
}

/** Слабых мест на экране. */
export const PATH_WEAK = 5;
