import { describe, expect, it } from 'vitest';
import { dayNumber, dueCards, fromSm2, gradeFor, isDue, newCard, retrievability, review } from './srs';

const T0 = new Date(2026, 0, 10, 15, 0).getTime();
const DAY = 86_400_000;

describe('FSRS', () => {
  it('новая карточка доступна сегодня', () => {
    const c = newCard('cafe.te', T0);
    expect(c).toMatchObject({ state: 0, stability: 0, interval: 0 });
    expect(isDue(c, T0)).toBe(true);
  });

  it('верные ответы растят стабильность и интервал', () => {
    let c = review(newCard('w', T0), 4, T0);
    expect(c.state).toBe(2);
    expect(c.interval).toBe(3);
    expect(c.due).toBe(dayNumber(T0) + 3);
    const s1 = c.stability;
    c = review(c, 5, T0 + 3 * DAY);
    expect(c.stability).toBeGreaterThan(s1 * 3);
    expect(c.interval).toBeGreaterThan(7);
    expect(c.reps).toBe(2);
  });

  it('«почти» — Hard: интервал короче, чем у верного ответа', () => {
    const good = review(review(newCard('w', T0), 4, T0), 4, T0 + 3 * DAY);
    const hard = review(review(newCard('w', T0), 4, T0), 3, T0 + 3 * DAY);
    expect(hard.interval).toBeLessThan(good.interval);
    expect(hard.difficulty).toBeGreaterThan(good.difficulty);
  });

  it('ошибка — Again: провал, короткий интервал, слово стало труднее', () => {
    let c = review(newCard('w', T0), 4, T0);
    c = review(c, 4, T0 + 3 * DAY);
    const before = c;
    c = review(c, 1, T0 + 20 * DAY);
    expect(c.lapses).toBe(1);
    expect(c.stability).toBeLessThan(before.stability);
    expect(c.difficulty).toBeGreaterThan(before.difficulty);
    expect(c.interval).toBeLessThanOrEqual(3);
  });

  it('due по календарным дням, а не по 24 часам', () => {
    const lateEvening = new Date(2026, 0, 10, 23, 50).getTime();
    const c = review(newCard('w', lateEvening), 1, lateEvening);
    expect(c.interval).toBe(1);
    const nextMorning = new Date(2026, 0, 11, 0, 10).getTime();
    expect(isDue(c, nextMorning)).toBe(true);
  });

  it('вероятность вспомнить падает со временем и равна 0.9 в срок', () => {
    const c = review(newCard('w', T0), 4, T0);
    expect(retrievability(c, T0)).toBeCloseTo(1, 2);
    // Библиотека считает прошедшие дни целыми, поэтому в срок значение около 0.9, а не ровно.
    expect(retrievability(c, T0 + c.stability * DAY)).toBeCloseTo(0.9, 1);
    expect(retrievability(c, T0 + 60 * DAY)).toBeLessThan(0.65);
    expect(retrievability(newCard('x', T0), T0)).toBe(0);
  });
});

describe('перенос SM-2 → FSRS', () => {
  const sm2 = (ef: number, interval: number, reps = 3) =>
    ({ wordId: 'w', ef, interval, reps, due: 500, lapses: 0, learnedAt: 1, lastReviewedAt: T0 }) as Parameters<typeof fromSm2>[0];

  it('стабильность из интервала (не меньше 1), сложность из лёгкости, срок не меняется', () => {
    expect(fromSm2(sm2(2.5, 6))).toMatchObject({ stability: 6, difficulty: 5, state: 2, due: 500, interval: 6 });
    expect(fromSm2(sm2(1.3, 0, 0))).toMatchObject({ state: 0, stability: 0 });
    expect(fromSm2(sm2(1.3, 1, 0))).toMatchObject({ stability: 1, difficulty: 9, state: 2 });
    expect(fromSm2(sm2(2.8, 40)).difficulty).toBe(4);
  });

  it('уже перенесённая карточка не меняется, после переноса повторение работает', () => {
    const c = fromSm2(sm2(2.2, 15));
    expect(fromSm2(c)).toBe(c);
    const next = review(c, 4, T0 + 15 * DAY);
    expect(next.stability).toBeGreaterThan(15);
    expect(next.due).toBeGreaterThan(dayNumber(T0 + 15 * DAY) + 15);
  });
});

describe('оценки и очередь', () => {
  it('gradeFor', () => {
    expect(gradeFor('correct', true)).toBe(5);
    expect(gradeFor('correct', false)).toBe(4);
    expect(gradeFor('almost', true)).toBe(3);
    expect(gradeFor('wrong', false)).toBe(1);
  });

  it('dueCards сортирует по просрочке', () => {
    const a = { ...newCard('a', T0), due: dayNumber(T0) - 3 };
    const b = { ...newCard('b', T0), due: dayNumber(T0) };
    const c = { ...newCard('c', T0), due: dayNumber(T0) + 2 };
    expect(dueCards([b, c, a], T0).map((x) => x.wordId)).toEqual(['a', 'b']);
  });
});
