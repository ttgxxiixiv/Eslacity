import { describe, expect, it } from 'vitest';
import {
  ACTIVE_LINES, applyGains, bestMedals, currentTier, gainsReward, gainTitle, isMidnight, LINES, medalGains, nextThreshold, plural, progressText,
  SECRETS, tierFor, TIERS, type MedalCounters, type MedalsState,
} from './medals';

const zero: MedalCounters = {
  wordsSolid: 0, streakBest: 0, grammarDone: 0, blitzBest: 0, typedBest: 0, buildingLevels: 1, listenCorrect: 0, freezesUsed: 0,
};
const empty: MedalsState = { lines: {}, secrets: {} };
const line = (id: string) => LINES.find((l) => l.id === id)!;
const ids = (c: MedalCounters, st = empty, e = {}) =>
  medalGains(c, st, e).map((g) => (g.kind === 'line' ? `${g.line.id}.${g.tier}` : g.secret.id));

describe('линии медалей', () => {
  it('12 линий по шесть растущих порогов, включены семь', () => {
    expect(LINES).toHaveLength(12);
    for (const l of LINES) for (let i = 1; i < 6; i++) expect(l.thresholds[i]).toBeGreaterThan(l.thresholds[i - 1]);
    expect(ACTIVE_LINES.map((l) => l.id)).toEqual(['words', 'streak', 'grammar', 'blitz', 'typed', 'builder', 'listener']);
  });
  it('пороги Словесника ведут к 3000', () => {
    expect(line('words').thresholds).toEqual([10, 100, 500, 1200, 2200, 3000]);
  });
  it('ступень по значению и следующий порог', () => {
    const w = line('words');
    expect(tierFor(w, 9)).toBeNull();
    expect(tierFor(w, 10)).toBe('wood');
    expect(tierFor(w, 1199)).toBe('bronze');
    expect(tierFor(w, 5000)).toBe('diamond');
    expect(nextThreshold(w, 150)).toEqual({ tier: 'bronze', at: 500 });
    expect(nextThreshold(w, 3000)).toBeNull();
  });
});

describe('получение', () => {
  it('на старте ничего нет', () => {
    expect(ids(zero)).toEqual([]);
  });
  it('перескок через ступени даёт каждую с наградой', () => {
    const g = medalGains({ ...zero, streakBest: 15 }, empty);
    expect(g.map((x) => x.kind === 'line' && x.tier)).toEqual(['wood', 'stone', 'bronze']);
    expect(gainsReward(g)).toBe(10 + 25 + 50);
    expect(gainTitle(g[2])).toBe('Бронзовая медаль «Упорство»');
  });
  it('записанная ступень не выдаётся второй раз', () => {
    const c = { ...zero, typedBest: 12 };
    const st = applyGains(empty, medalGains(c, empty), 1000);
    expect(st.lines.typed).toEqual({ wood: 1000, stone: 1000 });
    expect(currentTier(st.lines.typed)).toBe('stone');
    expect(medalGains(c, st)).toEqual([]);
    expect(ids({ ...c, typedBest: 20 }, st)).toEqual(['typed.bronze']);
  });
  it('выключенные линии не выдаются', () => {
    expect(TIERS).toHaveLength(6);
    expect(ids({ ...zero, grammarDone: 1 })).toEqual(['grammar.wood']);
  });
});

describe('тайные медали', () => {
  it('спасённый стрик по счётчику заморозок', () => {
    expect(ids({ ...zero, freezesUsed: 1 })).toEqual(['saved-streak']);
  });
  it('урок без ошибок и урок после полуночи — по событию', () => {
    const night = new Date(2026, 8, 25, 0, 30).getTime();
    const day = new Date(2026, 8, 25, 14, 0).getTime();
    expect(isMidnight(night)).toBe(true);
    expect(isMidnight(day)).toBe(false);
    expect(ids(zero, empty, { perfectLesson: true, lessonAt: night })).toEqual(['flawless', 'midnight']);
    expect(ids(zero, empty, { perfectLesson: false, lessonAt: day })).toEqual([]);
    const st = applyGains(empty, medalGains(zero, empty, { perfectLesson: true }), 5);
    expect(ids(zero, st, { perfectLesson: true })).toEqual([]);
  });
  it('будущие тайные медали пока не выдаются', () => {
    expect(SECRETS.filter((s) => s.test).map((s) => s.id)).toEqual(['saved-streak', 'flawless', 'midnight']);
  });
});

describe('подписи и лучшие медали', () => {
  it('строка прогресса с единицей и ступенью в родительном падеже', () => {
    expect(progressText(line('words'), 312)).toBe('312 / 500 слов до бронзы');
    expect(progressText(line('streak'), 0)).toBe('0 / 3 дня до дерева');
    expect(progressText(line('grammar'), 0)).toBe('0 / 1 урок до дерева');
    expect(progressText(line('typed'), 120)).toBe('120 вводов, все ступени');
  });
  it('русское множественное число', () => {
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => plural(n, ['слово', 'слова', 'слов']))).toEqual(
      ['слово', 'слова', 'слов', 'слов', 'слово', 'слова', 'слов'],
    );
  });
  it('три лучшие: выше ступень, при равенстве раньше полученная', () => {
    const st: MedalsState = {
      lines: {
        words: { wood: 5 },
        streak: { wood: 1, stone: 2, bronze: 9 },
        typed: { wood: 1, stone: 3 },
        blitz: { wood: 1, stone: 2 },
      },
      secrets: {},
    };
    expect(bestMedals(st).map((b) => `${b.line.id}.${b.tier}`)).toEqual(['streak.bronze', 'blitz.stone', 'typed.stone']);
    expect(bestMedals(empty)).toEqual([]);
  });
});
