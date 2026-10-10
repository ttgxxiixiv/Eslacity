import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { EMPTY_RUMORS, type RumorsRecord } from '../domain/rumor';

interface RumorsState {
  rec: RumorsRecord;
  hydrate(d: Partial<RumorsRecord> | undefined): void;
  /** Событие дня пройдено; слух (если ещё остались) — в собранные. */
  complete(day: number, rumor: string | null): void;
}

/** Слухи города (задача 13.7): `meta.rumors` — день последнего события и собранные слухи. */
export const useRumors = create<RumorsState>((set, get) => ({
  rec: EMPTY_RUMORS,
  hydrate(d) {
    set({ rec: { ...EMPTY_RUMORS, ...d, got: [...(d?.got ?? [])] } });
  },
  complete(day, rumor) {
    const r = get().rec;
    const rec: RumorsRecord = { day, got: rumor && !r.got.includes(rumor) ? [...r.got, rumor] : r.got };
    set({ rec });
    persist(() => db.meta.put({ key: 'rumors', value: rec }));
  },
}));
