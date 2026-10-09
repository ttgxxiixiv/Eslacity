import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import type { DisputeMove } from '../content/schema';
import { applySets, EMPTY_STORY, type StoryRecord } from '../domain/story';

interface StoryState {
  rec: StoryRecord;
  hydrate(d: Partial<StoryRecord> | undefined): void;
  /** Флаги выбранной ветки: уже поставленные не меняются. */
  set(sets: Record<string, string> | undefined, move?: DisputeMove): void;
}

/** Флаги истории (задача 13.6): `meta.story` — что герой выбрал в развилках миссий. */
export const useStory = create<StoryState>((set, get) => ({
  rec: EMPTY_STORY,
  hydrate(d) {
    set({ rec: { flags: { ...d?.flags }, moves: { ...d?.moves } } });
  },
  set(sets, move) {
    const rec = applySets(get().rec, sets, move);
    if (rec === get().rec) return;
    set({ rec });
    persist(() => db.meta.put({ key: 'story', value: rec }));
  },
}));
