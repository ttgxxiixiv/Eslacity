import { create } from 'zustand';
import type { BlitzMode, CloakId } from '../config';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { heroLevel } from '../domain/heroLevel';
import type { LanternId } from '../domain/decor';
import { EMPTY_REWARDS, grantUpTo, normalizeRewards, spendHint, type RewardsRecord } from '../domain/rewards';
import { useProgress } from './progress';

interface RewardsState {
  rec: RewardsRecord;
  hydrate(d: Partial<RewardsRecord> | undefined): void;
  /** Выдать награды уровней до текущего уровня героя (и задним числом). */
  sync(): void;
  /** Потратить жетон подсказки. false, если жетонов нет. */
  spendHint(): boolean;
  setCloak(id: CloakId): void;
  setLantern(id: LanternId): void;
  /** Показать или убрать украшение линии с карты города. */
  toggleDecor(line: string): void;
  /** Рекорд режима блица. Возвращает true, если это новый рекорд. */
  recordBlitz(mode: BlitzMode, score: number): boolean;
}

export const useRewards = create<RewardsState>((set, get) => {
  const save = (rec: RewardsRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'rewards', value: rec }));
  };
  return {
    rec: EMPTY_REWARDS,

    hydrate(d) {
      set({ rec: normalizeRewards(d) });
    },

    sync() {
      const { rec } = grantUpTo(get().rec, heroLevel(useProgress.getState().xpTotal).level);
      if (rec !== get().rec) save(rec);
    },

    spendHint() {
      const rec = spendHint(get().rec);
      if (rec === get().rec) return false;
      save(rec);
      return true;
    },

    setCloak(id) {
      if (get().rec.cloaks.includes(id) && get().rec.cloak !== id) save({ ...get().rec, cloak: id });
    },

    setLantern(id) {
      if (get().rec.lantern !== id) save({ ...get().rec, lantern: id });
    },

    toggleDecor(line) {
      const hidden = get().rec.hiddenDecor ?? [];
      save({ ...get().rec, hiddenDecor: hidden.includes(line) ? hidden.filter((l) => l !== line) : [...hidden, line] });
    },

    recordBlitz(mode, score) {
      const prev = get().rec.blitzBest[mode] ?? 0;
      if (score <= prev) return false;
      save({ ...get().rec, blitzBest: { ...get().rec.blitzBest, [mode]: score } });
      return true;
    },
  };
});

/** Награды выдаются, как только растёт уровень героя: подписка на опыт. */
export function watchLevelRewards(): () => void {
  return useProgress.subscribe((s, prev) => {
    if (s.xpTotal !== prev.xpTotal) useRewards.getState().sync();
  });
}
