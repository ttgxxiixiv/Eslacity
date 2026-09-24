import { describe, expect, it } from 'vitest';
import { dayNumber, dueCards, gradeFor, isDue, newCard, review } from './srs';

const T0 = new Date(2026, 0, 10, 15, 0).getTime();
const DAY = 86_400_000;

describe('SM-2', () => {
  it('новая карточка доступна сегодня', () => {
    const c = newCard('cafe.te', T0);
    expect(c.ef).toBe(2.5);
    expect(isDue(c, T0)).toBe(true);
  });

  it('интервалы 1, 6, затем × EF', () => {
    let c = newCard('w', T0);
    c = review(c, 4, T0);
    expect([c.reps, c.interval, c.ef]).toEqual([1, 1, 2.5]);
    c = review(c, 4, T0 + DAY);
    expect([c.reps, c.interval]).toEqual([2, 6]);
    c = review(c, 5, T0 + 7 * DAY);
    expect(c.ef).toBeCloseTo(2.6);
    expect(c.interval).toBe(15); // интервал считается по EF до обновления
    expect(c.due).toBe(dayNumber(T0 + 7 * DAY) + c.interval);
  });

  it('оценка 3 снижает EF, но не сбрасывает', () => {
    const c = review(newCard('w', T0), 3, T0);
    expect(c.reps).toBe(1);
    expect(c.ef).toBeCloseTo(2.36);
  });

  it('ошибка сбрасывает повторения и считает провал', () => {
    let c = newCard('w', T0);
    c = review(c, 5, T0);
    c = review(c, 5, T0 + DAY);
    c = review(c, 1, T0 + 7 * DAY);
    expect(c.reps).toBe(0);
    expect(c.interval).toBe(1);
    expect(c.lapses).toBe(1);
    expect(c.due).toBe(dayNumber(T0 + 8 * DAY));
  });

  it('EF не опускается ниже 1.3', () => {
    let c = newCard('w', T0);
    for (let i = 0; i < 20; i++) c = review(c, 0, T0);
    expect(c.ef).toBe(1.3);
  });

  it('due по календарным дням, а не по 24 часам', () => {
    const lateEvening = new Date(2026, 0, 10, 23, 50).getTime();
    const c = review(newCard('w', lateEvening), 4, lateEvening);
    const nextMorning = new Date(2026, 0, 11, 0, 10).getTime();
    expect(isDue(c, nextMorning)).toBe(true);
  });

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
