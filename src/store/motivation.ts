import { create } from 'zustand';
import { ECONOMY } from '../config';
import { LOCATIONS } from '../content/locations';
import { lessonsOf } from '../content/grammar';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { type Achievement, newlyUnlocked } from '../domain/achievements';
import { challengeFor, weekKey, weeklyProgress } from '../domain/goals';
import { dayNumber } from '../domain/srs';
import { canBuyFreeze, EMPTY_STREAK, registerGoal, settleStreak, type StreakState } from '../domain/streak';
import { useCity } from './city';
import { useProgress } from './progress';
import { useSettings } from './settings';

export interface MotivationData {
  streak: StreakState;
  achievements: Record<string, number>;
  weeklyClaimed: string | null;
  typedRun: number;
  typedBest: number;
}

const EMPTY: MotivationData = { streak: EMPTY_STREAK, achievements: {}, weeklyClaimed: null, typedRun: 0, typedBest: 0 };

interface MotivationState extends MotivationData {
  hydrate(d: Partial<MotivationData> | undefined): void;
  settle(now?: number): void;
  onGoalMet(now?: number): void;
  buyFreeze(): boolean;
  /** Забрать награду за недельный челлендж. 0, если ещё рано или уже забрана. */
  claimWeekly(now?: number): number;
  recordTyped(correct: boolean): void;
  /** Проверить достижения. Возвращает только что открытые. */
  evaluate(now?: number): Achievement[];
}

function save(s: MotivationData) {
  const { streak, achievements, weeklyClaimed, typedRun, typedBest } = s;
  persist(() => db.meta.put({ key: 'motivation', value: { streak, achievements, weeklyClaimed, typedRun, typedBest } }));
}

export const useMotivation = create<MotivationState>((set, get) => {
  const update = (patch: Partial<MotivationData>) => {
    set(patch);
    save(get());
  };

  return {
    ...EMPTY,

    hydrate(d) {
      set({ ...EMPTY, ...d, streak: { ...EMPTY_STREAK, ...d?.streak } });
    },

    settle(now = Date.now()) {
      const prev = get().streak;
      const next = settleStreak(prev, dayNumber(now));
      if (next !== prev) update({ streak: next });
    },

    onGoalMet(now = Date.now()) {
      const today = dayNumber(now);
      update({ streak: registerGoal(settleStreak(get().streak, today), today) });
    },

    buyFreeze() {
      const city = useCity.getState();
      const { streak } = get();
      if (!canBuyFreeze(streak, city.coins)) return false;
      city.addCoins(-ECONOMY.freezeCost);
      update({ streak: { ...streak, freezes: streak.freezes + 1 } });
      return true;
    },

    claimWeekly(now = Date.now()) {
      const today = dayNumber(now);
      const key = weekKey(today);
      if (get().weeklyClaimed === key) return 0;
      const c = challengeFor(today);
      const rows = Object.values(useProgress.getState().days);
      if (weeklyProgress(c, rows, today) < c.target) return 0;
      useCity.getState().addCoins(c.reward);
      update({ weeklyClaimed: key });
      return c.reward;
    },

    recordTyped(correct) {
      const typedRun = correct ? get().typedRun + 1 : 0;
      update({ typedRun, typedBest: Math.max(get().typedBest, typedRun) });
    },

    evaluate(now = Date.now()) {
      const p = useProgress.getState();
      const buildings = Object.values(useCity.getState().buildings).filter((b) => b && b.level > 0);
      const today = dayNumber(now);
      const a1 = lessonsOf('A1');
      const s = get();
      const found = newlyUnlocked(
        {
          learnedWords: Object.keys(p.cards).length,
          openBuildings: buildings.length,
          totalBuildings: LOCATIONS.length,
          maxBuildingLevel: Math.max(0, ...buildings.map((b) => b!.level)),
          streakBest: s.streak.best,
          weekReviews: weeklyProgress({ id: 'reviews', text: '', target: 0, reward: 0 }, Object.values(p.days), today),
          grammarDone: a1.filter((l) => p.grammar[l.id]).length,
          grammarA1Total: a1.length,
          blitzBest: useSettings.getState().blitzBest,
          typedBest: s.typedBest,
          freezesUsed: s.streak.freezesUsed,
        },
        s.achievements,
      );
      if (found.length) {
        const achievements = { ...s.achievements };
        for (const a of found) achievements[a.id] = now;
        update({ achievements });
      }
      return found;
    },
  };
});
