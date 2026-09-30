import { useMemo } from 'react';
import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { elixirStrength, EMPTY_KEEPER, recordStrength, type KeeperRecord } from '../domain/keeper';
import { useProgress } from './progress';
import { useSphinx } from './sphinx';

interface KeeperState {
  rec: KeeperRecord;
  hydrate(d: Partial<KeeperRecord> | undefined): void;
  /** Замерить силу Эликсира (только после Эликсира): при запуске и после занятий. */
  measure(now?: number): void;
}

export const useKeeper = create<KeeperState>((set, get) => ({
  rec: EMPTY_KEEPER,

  hydrate(d) {
    set({ rec: { ...EMPTY_KEEPER, ...d, days: { ...d?.days } } });
  },

  measure(now = Date.now()) {
    if (useSphinx.getState().rec.elixir === undefined) return;
    const rec = recordStrength(get().rec, elixirStrength(Object.values(useProgress.getState().cards), now), now);
    if (rec === get().rec) return;
    set({ rec });
    persist(() => db.meta.put({ key: 'keeper', value: rec }));
  },
}));

/** Сила Эликсира сейчас: пересчитывается при изменении карточек. */
export function useElixirStrength(now: number): number {
  const cards = useProgress((s) => s.cards);
  return useMemo(() => elixirStrength(Object.values(cards), now), [cards, now]);
}
