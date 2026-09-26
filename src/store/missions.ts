import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';

/** Прохождения миссии: сколько раз начата (от этого режим ответа), лучший результат, когда засчитана. */
export interface MissionRecord {
  attempts: number;
  /** Лучшая доля верных ответов героя, 0–1. */
  best: number;
  /** Время, когда миссия засчитана впервые. */
  done?: number;
}

export type MissionsData = Record<string, MissionRecord>;

interface MissionsState {
  records: MissionsData;
  hydrate(d: MissionsData | undefined): void;
  /** Начато прохождение: номер этого прохождения (с 1). */
  start(id: string): number;
  /** Прохождение закончено. Возвращает true, если миссия засчитана впервые (за это награда). */
  finish(id: string, share: number, passed: boolean, now?: number): boolean;
}

function save(records: MissionsData) {
  persist(() => db.meta.put({ key: 'missions', value: records }));
}

export const useMissions = create<MissionsState>((set, get) => ({
  records: {},

  hydrate(d) {
    set({ records: { ...d } });
  },

  start(id) {
    const prev = get().records[id] ?? { attempts: 0, best: 0 };
    const records = { ...get().records, [id]: { ...prev, attempts: prev.attempts + 1 } };
    set({ records });
    save(records);
    return prev.attempts + 1;
  },

  finish(id, share, passed, now = Date.now()) {
    const prev = get().records[id] ?? { attempts: 1, best: 0 };
    const first = passed && prev.done === undefined;
    const records = { ...get().records, [id]: { ...prev, best: Math.max(prev.best, share), done: prev.done ?? (passed ? now : undefined) } };
    set({ records });
    save(records);
    return first;
  },
}));

/** Миссия места в главе засчитана. */
export const isMissionDone = (records: MissionsData, place: string, chapter: number) => records[`ms:${place}.${chapter}`]?.done !== undefined;
