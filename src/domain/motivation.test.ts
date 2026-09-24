import { describe, expect, it } from 'vitest';
import type { DayRow } from '../db/db';
import { ACHIEVEMENTS, newlyUnlocked, type AchievementCtx } from './achievements';
import { challengeFor, weekStart, weeklyProgress, WEEKLY_TEMPLATES } from './goals';
import { dayNumber } from './srs';
import { canBuyFreeze, EMPTY_STREAK, isAlive, registerGoal, settleStreak } from './streak';

describe('стрик', () => {
  it('растёт при выполнении цели в соседние дни', () => {
    let s = registerGoal(EMPTY_STREAK, 100);
    s = registerGoal(s, 101);
    s = registerGoal(s, 101); // повторно в тот же день не считается
    s = registerGoal(s, 102);
    expect(s.count).toBe(3);
    expect(s.best).toBe(3);
  });

  it('без заморозок пропуск обнуляет стрик', () => {
    let s = registerGoal(registerGoal(EMPTY_STREAK, 100), 101);
    expect(isAlive(s, 102)).toBe(true);
    s = settleStreak(s, 103);
    expect(s.count).toBe(0);
    expect(s.best).toBe(2);
    expect(registerGoal(s, 103).count).toBe(1);
  });

  it('заморозка закрывает один пропущенный день', () => {
    let s = { ...registerGoal(EMPTY_STREAK, 100), freezes: 2 };
    s = settleStreak(s, 102); // 101 пропущен
    expect(s).toMatchObject({ count: 1, freezes: 1, freezesUsed: 1, lastDay: 101 });
    s = registerGoal(s, 102);
    expect(s.count).toBe(2);
  });

  it('двух заморозок на три пропуска не хватает, и они не тратятся', () => {
    let s = { ...registerGoal(EMPTY_STREAK, 100), freezes: 2 };
    s = settleStreak(s, 104);
    expect(s).toMatchObject({ count: 0, freezes: 2, freezesUsed: 0 });
  });

  it('повторная проверка в тот же день ничего не меняет', () => {
    const s = { ...registerGoal(EMPTY_STREAK, 100), freezes: 1 };
    const a = settleStreak(s, 102);
    expect(settleStreak(a, 102)).toEqual(a);
  });

  it('заморозку можно купить, если есть монеты и место', () => {
    expect(canBuyFreeze(EMPTY_STREAK, 150)).toBe(true);
    expect(canBuyFreeze(EMPTY_STREAK, 149)).toBe(false);
    expect(canBuyFreeze({ ...EMPTY_STREAK, freezes: 2 }, 1000)).toBe(false);
  });
});

describe('недельный челлендж', () => {
  it('неделя начинается с понедельника', () => {
    const mon = dayNumber(new Date(2026, 8, 21, 12).getTime()); // 21.09.2026 — понедельник
    const sun = dayNumber(new Date(2026, 8, 27, 12).getTime());
    expect(weekStart(mon)).toBe(mon);
    expect(weekStart(sun)).toBe(mon);
    expect(weekStart(sun + 1)).toBe(mon + 7);
  });

  it('шаблоны сменяются по неделям', () => {
    const d = dayNumber(new Date(2026, 8, 23).getTime());
    const ids = [0, 7, 14, 21].map((k) => challengeFor(d + k).id);
    expect(new Set(ids).size).toBe(WEEKLY_TEMPLATES.length);
  });

  it('считает прогресс только за текущую неделю', () => {
    const today = dayNumber(new Date(2026, 8, 24, 12).getTime()); // среда
    const row = (date: string, p: Partial<DayRow>): DayRow => ({
      date, xp: 0, newWords: 0, reviews: 0, lessons: 0, grammarLessons: 0, ...p,
    });
    const rows = [
      row('2026-09-20', { newWords: 30, goalMet: true }), // прошлое воскресенье
      row('2026-09-21', { newWords: 10, goalMet: true }),
      row('2026-09-24', { newWords: 5, goalMet: true }),
      row('2026-09-23', { newWords: 2 }),
    ];
    expect(weeklyProgress(WEEKLY_TEMPLATES[0], rows, today)).toBe(17);
    expect(weeklyProgress(WEEKLY_TEMPLATES[3], rows, today)).toBe(2);
  });
});

describe('достижения', () => {
  const zero: AchievementCtx = {
    learnedWords: 0, openBuildings: 1, totalBuildings: 20, maxBuildingLevel: 1, streakBest: 0, weekReviews: 0,
    grammarDone: 0, grammarA1Total: 31, blitzBest: 0, typedBest: 0, freezesUsed: 0,
  };
  it('от 15 до 20 достижений, id уникальны', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('на старте ничего не открыто', () => {
    expect(newlyUnlocked(zero, {})).toEqual([]);
  });
  it('открывает новые и не повторяет открытые', () => {
    const ctx = { ...zero, learnedWords: 60 };
    expect(newlyUnlocked(ctx, {}).map((a) => a.id)).toEqual(['word-1', 'word-50']);
    expect(newlyUnlocked(ctx, { 'word-1': 1 }).map((a) => a.id)).toEqual(['word-50']);
  });
});
