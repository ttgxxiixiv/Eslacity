import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { DIARY } from '../content/diary';
import type { DiarySources } from '../domain/diary';
import { useMissions } from './missions';
import { useRumors } from './rumors';
import { useThread } from './thread';
import { isLineId } from '../domain/itemId';

export interface DiaryRecord {
  /** Дослушанные разговоры `sc:`: открывают записи дневника, из них же реплики диктанта (задача 21.5). */
  scenes: string[];
}

interface DiaryState {
  rec: DiaryRecord;
  hydrate(d: Partial<DiaryRecord> | undefined): void;
  /** Разговор дослушан до конца: открывает записи дневника с этим источником. */
  see(sceneId: string): void;
}

/** Дневник путника (задача 13.8): `meta.diary` — дослушанные разговоры, остальные источники в своих записях. */
export const useDiary = create<DiaryState>((set, get) => ({
  rec: { scenes: [] },
  hydrate(d) {
    set({ rec: { scenes: [...(d?.scenes ?? [])] } });
  },
  see(sceneId) {
    // Записываются разговоры жителей (из них диктант) и всё, что открывает записи дневника; сцены нити — нет.
    if (get().rec.scenes.includes(sceneId) || !(isLineId(sceneId) || DIARY.some((e) => e.from === sceneId))) return;
    const rec = { scenes: [...get().rec.scenes, sceneId] };
    set({ rec });
    persist(() => db.meta.put({ key: 'diary', value: rec }));
  },
}));

/** Источники записей из текущего состояния хранилищ. */
export function diarySources(): DiarySources {
  return {
    scenes: new Set(useDiary.getState().rec.scenes),
    missions: new Set(Object.entries(useMissions.getState().records).flatMap(([id, r]) => (r.done !== undefined ? [id] : []))),
    thread: new Set(Object.keys(useThread.getState().rec.seen)),
    rumors: new Set(useRumors.getState().rec.got),
  };
}

/** Дослушанные разговоры жителей. */
export function heardScenes(): string[] {
  return useDiary.getState().rec.scenes;
}
