import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from './answerLog';
import { ACTIVE_MS_CAP, minutesPerDay, pathAccuracy, pathSkillOf, wordsByChapter } from './myPath';

const NOW = new Date(2026, 9, 10, 12).getTime();
const DAY = 86_400_000;
const r = (p: Partial<AnswerRecord>): AnswerRecord => ({ ts: NOW, itemId: 'cafe.te', kind: 'choice-es-ru', verdict: 'correct', mode: 'learn', ms: 3000, ...p });

describe('Мой путь', () => {
  it('навык: правила — грамматика, остальное по виду задания', () => {
    expect(pathSkillOf(r({ itemId: 'g:a1.02-ser.3', kind: 'grammar-type' }))).toBe('grammar');
    expect(pathSkillOf(r({ kind: 'listen-choice' }))).toBe('listen');
    expect(pathSkillOf(r({ kind: 'type' }))).toBe('type');
    expect(pathSkillOf(r({ kind: 'scramble' }))).toBe('choice');
  });

  it('точность за 7 и 30 дней считает только своё окно', () => {
    const rows = [r({}), r({ verdict: 'wrong' }), r({ ts: NOW - 10 * DAY, verdict: 'wrong' }), r({ itemId: 'g:a1.01.1', kind: 'grammar-gap', verdict: 'almost' })];
    const week = pathAccuracy(rows, NOW, 7);
    expect(week.choice).toMatchObject({ total: 2, accuracy: 0.5 });
    expect(week.grammar).toMatchObject({ total: 1, accuracy: 0.5 });
    expect(week.listen.accuracy).toBeNull();
    expect(pathAccuracy(rows, NOW, 30).choice).toMatchObject({ total: 3 });
  });

  it('минуты по дням: долгий ответ обрезается, старые дни не попадают', () => {
    const rows = [r({ ms: 60_000 }), r({ ms: 30 * 60_000 }), r({ ts: NOW - DAY, ms: 90_000 }), r({ ts: NOW - 9 * DAY, ms: 600_000 })];
    const days = minutesPerDay(rows, NOW, 7);
    expect(days).toHaveLength(7);
    expect(days[6].minutes).toBe(Math.round((60_000 + ACTIVE_MS_CAP) / 60_000));
    expect(days[5].minutes).toBe(2);
    expect(days.slice(0, 5).every((d) => d.minutes === 0)).toBe(true);
  });

  it('слова по главам: всего, выучено, закреплено', () => {
    const chapter: Record<string, number> = { a: 1, b: 1, c: 2, d: 3 };
    const out = wordsByChapter(['a', 'b', 'c', 'd', 'x'], (id) => chapter[id], { a: { stability: 30, interval: 1 }, b: { stability: 2, interval: 1 }, c: { interval: 25 } }, [1, 2]);
    expect(out).toEqual([
      { chapter: 1, total: 2, learned: 2, solid: 1 },
      { chapter: 2, total: 1, learned: 1, solid: 1 },
    ]);
  });
});
