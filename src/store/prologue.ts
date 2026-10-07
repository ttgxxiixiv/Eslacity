import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { EMPTY_PROLOGUE, legacyPrologue, type PrologueRecord } from '../domain/prologue';

interface PrologueState {
  rec: PrologueRecord;
  /** `hasProgress` — у путника уже есть карточки: пролог ему не показывается (начал до 2.130.0). */
  hydrate(d: PrologueRecord | undefined, hasProgress: boolean, now?: number): void;
  /** Пролог пройден: обрывок пролога получен. */
  finish(now?: number): void;
  /** Пролог пропущен: обрывка нет. */
  skip(now?: number): void;
}

export const usePrologue = create<PrologueState>((set, get) => {
  const save = (rec: PrologueRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'prologue', value: rec }));
  };
  return {
    rec: EMPTY_PROLOGUE,

    hydrate(d, hasProgress, now = Date.now()) {
      const rec = legacyPrologue(d, hasProgress, now);
      if (rec !== d && rec.done) save(rec);
      else set({ rec });
    },

    finish(now = Date.now()) {
      const r = get().rec;
      save({ ...r, done: r.done ?? now, shard: r.shard ?? now });
    },

    skip(now = Date.now()) {
      if (get().rec.skipped === undefined && get().rec.done === undefined) save({ ...get().rec, skipped: now });
    },
  };
});
