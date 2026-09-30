import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { EMPTY_PLACEMENT, placementGrant, type PlacementRecord } from '../domain/placement';
import { useCity } from './city';
import { useJourney } from './journey';
import { useProgress } from './progress';

interface PlacementState {
  rec: PlacementRecord;
  hydrate(d: Partial<PlacementRecord> | undefined): void;
  /** Путник отказался от теста при первом запуске: больше не предлагать на главной. */
  skip(now?: number): void;
  /**
   * Итог теста: `passed` глав засчитано подряд с первой, `known` — верно названные слова этих глав.
   * Выдаёт обрывки, печати, уровень зданий и карточки; ничего полученного не отнимает.
   */
  finish(passed: number, known: string[], now?: number): void;
}

export const usePlacement = create<PlacementState>((set, get) => {
  const save = (rec: PlacementRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'placement', value: rec }));
  };
  return {
    rec: EMPTY_PLACEMENT,

    hydrate(d) {
      set({ rec: { ...EMPTY_PLACEMENT, ...d } });
    },

    skip(now = Date.now()) {
      if (get().rec.skipped === undefined) save({ ...get().rec, skipped: now });
    },

    finish(passed, known, now = Date.now()) {
      const g = placementGrant(passed);
      if (known.length) useProgress.getState().addKnown(known, now);
      if (g.buildingLevel) useCity.getState().raiseAll(g.buildingLevel, now);
      if (g.fragmentChapters.length) useJourney.getState().grant(g.fragmentChapters, g.sealChapters, now);
      save({ ...get().rec, done: now, passed: Math.max(get().rec.passed ?? 0, passed) });
    },
  };
});
