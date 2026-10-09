import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { letterXp, type LetterEntry } from '../domain/letter';
import { useProgress } from './progress';

export interface LettersData {
  /** Дневник писем: все написанные письма, старые первыми. */
  entries: LetterEntry[];
}

interface LettersState extends LettersData {
  hydrate(d: Partial<LettersData> | undefined): void;
  /**
   * Письмо или записка записаны в дневник. Возвращает опыт: у письма — за первое по просьбе, у записки опыт
   * считает `noteXp` и передаёт сюда.
   */
  save(entry: LetterEntry, xp?: number): number;
}

export const useLetters = create<LettersState>((set, get) => ({
  entries: [],

  hydrate(d) {
    set({ entries: d?.entries ?? [] });
  },

  save(entry, given) {
    const xp = given ?? letterXp(get().entries, entry.letterId);
    const entries = [...get().entries, entry];
    set({ entries });
    persist(() => db.meta.put({ key: 'letters', value: { entries } }));
    if (xp) useProgress.getState().addXp(xp);
    return xp;
  },
}));
