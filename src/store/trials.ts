import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { finishTrial, type TrialsData } from '../domain/trial';

interface TrialsState {
  records: TrialsData;
  hydrate(d: TrialsData | undefined): void;
  /** Попытка закончена. Возвращает true, если испытание пройдено впервые (за это награда). */
  finish(id: string, share: number, passed: boolean, now?: number): boolean;
}

export const useTrials = create<TrialsState>((set, get) => ({
  records: {},

  hydrate(d) {
    set({ records: { ...d } });
  },

  finish(id, share, passed, now = Date.now()) {
    const { rec, first } = finishTrial(get().records[id], share, passed, now);
    const records = { ...get().records, [id]: rec };
    set({ records });
    persist(() => db.meta.put({ key: 'trials', value: records }));
    return first;
  },
}));
