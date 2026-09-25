import { create } from 'zustand';
import { ECONOMY } from '../config';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { challengeFor, weekKey, weeklyProgress } from '../domain/goals';
import {
  applyGains, gainsReward, medalGains, SOLID_INTERVAL_DAYS,
  type MedalCounters, type MedalEvent, type MedalGain, type MedalsState,
} from '../domain/medals';
import { dayNumber } from '../domain/srs';
import { canBuyFreeze, EMPTY_STREAK, registerGoal, settleStreak, type StreakState } from '../domain/streak';
import { useCity } from './city';
import { useJourney } from './journey';
import { fragmentCount } from '../domain/chapters';
import { useProgress } from './progress';
import { useSettings } from './settings';

export interface MotivationData {
  streak: StreakState;
  /** Старые достижения до версии 2.3.0: id и время. Не меняются, хранятся для истории. */
  achievements: Record<string, number>;
  weeklyClaimed: string | null;
  typedRun: number;
  typedBest: number;
  /** Полученные ступени медалей и тайные медали с временем получения. */
  medals: MedalsState;
  /** Верные ответы в заданиях на слух за всё время. null — ещё не посчитаны по журналу (до 2.3.0). */
  listenCorrect: number | null;
}

const EMPTY: MotivationData = {
  streak: EMPTY_STREAK, achievements: {}, weeklyClaimed: null, typedRun: 0, typedBest: 0,
  medals: { lines: {}, secrets: {} }, listenCorrect: null,
};

interface MotivationState extends MotivationData {
  /** Медали, которые ждут вручения на экране (не сохраняются). */
  awards: MedalGain[];
  /** Убрать показанную плашку вручения. */
  dismissAward(): void;
  hydrate(d: Partial<MotivationData> | undefined): void;
  settle(now?: number): void;
  onGoalMet(now?: number): void;
  buyFreeze(): boolean;
  /** Забрать награду за недельный челлендж. 0, если ещё рано или уже забрана. */
  claimWeekly(now?: number): number;
  recordTyped(correct: boolean): void;
  /** Верный ответ на слух: счётчик для «Слушателя». */
  recordListening(): void;
  /** Начальное значение счётчика слуха, если его ещё нет (перенос из журнала ответов). */
  initListening(count: number): void;
  /**
   * Проверить медали, записать новые ступени и выдать монеты. Возвращает только что полученные.
   * event — итог урока для тайных медалей. announce: false — без плашки вручения (перенос при запуске).
   */
  evaluate(now?: number, event?: MedalEvent, announce?: boolean): MedalGain[];
}

function save(s: MotivationData) {
  const { streak, achievements, weeklyClaimed, typedRun, typedBest, medals, listenCorrect } = s;
  persist(() =>
    db.meta.put({ key: 'motivation', value: { streak, achievements, weeklyClaimed, typedRun, typedBest, medals, listenCorrect } }),
  );
}

/** Счётчики медалей из текущего состояния хранилищ. */
export function medalCounters(): MedalCounters {
  const p = useProgress.getState();
  const s = useMotivation.getState();
  return {
    wordsSolid: Object.values(p.cards).filter((c) => c.interval >= SOLID_INTERVAL_DAYS).length,
    streakBest: s.streak.best,
    grammarDone: Object.keys(p.grammar).length,
    blitzBest: useSettings.getState().blitzBest,
    typedBest: s.typedBest,
    buildingLevels: Object.values(useCity.getState().buildings).reduce((n, b) => n + (b?.level ?? 0), 0),
    listenCorrect: s.listenCorrect ?? 0,
    freezesUsed: s.streak.freezesUsed,
    fragments: fragmentCount(useJourney.getState()),
  };
}

export const useMotivation = create<MotivationState>((set, get) => {
  const update = (patch: Partial<MotivationData>) => {
    set(patch);
    save(get());
  };

  return {
    ...EMPTY,
    awards: [],

    dismissAward() {
      set({ awards: get().awards.slice(1) });
    },

    hydrate(d) {
      set({ ...EMPTY, ...d, streak: { ...EMPTY_STREAK, ...d?.streak }, medals: { lines: {}, secrets: {}, ...d?.medals } });
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

    recordListening() {
      update({ listenCorrect: (get().listenCorrect ?? 0) + 1 });
    },

    initListening(count) {
      if (get().listenCorrect === null) update({ listenCorrect: count });
    },

    evaluate(now = Date.now(), event = {}, announce = true) {
      const gains = medalGains(medalCounters(), get().medals, event);
      if (gains.length) {
        update({ medals: applyGains(get().medals, gains, now) });
        if (announce) set({ awards: [...get().awards, ...gains] });
        useCity.getState().addCoins(gainsReward(gains));
      }
      return gains;
    },
  };
});

/**
 * Итог урока: сначала выдать обрывки карты (от них зависит «Картограф»), потом проверить медали.
 */
export function syncAndEvaluate(now = Date.now(), event: MedalEvent = {}): MedalGain[] {
  useJourney.getState().sync(now);
  return useMotivation.getState().evaluate(now, event);
}
