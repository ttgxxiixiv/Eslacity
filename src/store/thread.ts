import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { dayKey } from '../domain/srs';
import { EMPTY_THREAD, type ThreadRecord } from '../domain/thread';

interface ThreadState {
  rec: ThreadRecord;
  hydrate(d: ThreadRecord | undefined): void;
  /** Сцена нити прочитана. */
  see(id: string, now?: number): void;
  /** Записка дня прочитана. */
  readNote(now?: number): void;
}

/** Нить главы (задача 13.1): `meta.thread` — прочитанные сцены Летописца и день последней записки. */
export const useThread = create<ThreadState>((set, get) => {
  const save = (rec: ThreadRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'thread', value: rec }));
  };
  return {
    rec: EMPTY_THREAD,
    hydrate(d) {
      set({ rec: { ...EMPTY_THREAD, ...d, seen: { ...d?.seen } } });
    },
    see(id, now = Date.now()) {
      const r = get().rec;
      if (r.seen[id] === undefined) save({ ...r, seen: { ...r.seen, [id]: now } });
    },
    readNote(now = Date.now()) {
      const day = dayKey(now);
      if (get().rec.note !== day) save({ ...get().rec, note: day });
    },
  };
});
