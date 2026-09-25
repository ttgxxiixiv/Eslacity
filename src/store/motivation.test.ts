import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SrsCard } from '../domain/srs';
import { useCity } from './city';
import { useMotivation } from './motivation';
import { useProgress } from './progress';
import { useSettings } from './settings';

const card = (wordId: string, interval: number): SrsCard =>
  ({ wordId, ef: 2.5, interval, reps: 3, due: 0, lapses: 0, learnedAt: 0, lastReviewedAt: 0 }) as SrsCard;

/** Данные мотивации в том виде, как их сохраняла версия 2.2: старые достижения, медалей и счётчика слуха нет. */
const OLD = {
  streak: { count: 8, best: 8, lastDay: 100, freezes: 0, freezesUsed: 1 },
  achievements: { 'word-1': 1, 'streak-3': 2, 'streak-7': 3, 'freeze-1': 4 },
  weeklyClaimed: null,
  typedRun: 0,
  typedBest: 11,
};

beforeEach(() => {
  useProgress.getState().hydrate({
    cards: [card('cafe.a', 30), card('cafe.b', 25), ...Array.from({ length: 10 }, (_, i) => card(`cafe.x${i}`, 21)), card('cafe.c', 3)],
    days: [],
    xpTotal: 0,
    grammar: [],
  });
  useCity.getState().hydrate({ coins: 100, buildings: [{ locationId: 'cafe', level: 2, lastCollectedAt: 0 }] });
  useSettings.getState().hydrate({ blitzBest: 0 });
  useMotivation.getState().hydrate(OLD as never);
});

describe('перенос достижений в медали', () => {
  it('старые данные открываются, ступени считаются из счётчиков, награда выдаётся один раз', () => {
    const s = useMotivation.getState();
    expect(s.medals).toEqual({ lines: {}, secrets: {} });
    expect(s.listenCorrect).toBeNull();
    expect(s.achievements).toEqual(OLD.achievements);

    const gains = s.evaluate(1000);
    const got = gains.map((g) => (g.kind === 'line' ? `${g.line.id}.${g.tier}` : g.secret.id));
    // 12 слов с интервалом от 21 дня, стрик 8, 11 вводов подряд, уровни зданий 2, заморозка была.
    expect(got).toEqual(['words.wood', 'streak.wood', 'streak.stone', 'typed.wood', 'typed.stone', 'builder.wood', 'saved-streak']);
    expect(useCity.getState().coins).toBe(100 + 10 + 10 + 25 + 10 + 25 + 10 + 50);

    expect(useMotivation.getState().evaluate(2000)).toEqual([]);
    expect(useCity.getState().coins).toBe(240);
    expect(useMotivation.getState().medals.lines.streak).toEqual({ wood: 1000, stone: 1000 });
  });

  it('счётчик слуха переносится из журнала один раз и дальше растёт сам', () => {
    const m = useMotivation.getState();
    m.initListening(9);
    m.initListening(50);
    expect(useMotivation.getState().listenCorrect).toBe(9);
    useMotivation.getState().recordListening();
    const gains = useMotivation.getState().evaluate(1000);
    expect(gains.some((g) => g.kind === 'line' && g.line.id === 'listener' && g.tier === 'wood')).toBe(true);
  });

  it('тайные медали урока', () => {
    useMotivation.getState().evaluate(1000);
    const night = new Date(2026, 8, 25, 1, 0).getTime();
    const gains = useMotivation.getState().evaluate(night, { perfectLesson: true, lessonAt: night });
    expect(gains.map((g) => g.kind === 'secret' && g.secret.id)).toEqual(['flawless', 'midnight']);
  });
});
