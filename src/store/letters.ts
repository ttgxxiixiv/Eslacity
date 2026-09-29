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
  /** Письмо записано в дневник. Возвращает опыт: за первое письмо по просьбе, потом ноль. */
  save(entry: LetterEntry): number;
}

export const useLetters = create<LettersState>((set, get) => ({
  entries: [],

  hydrate(d) {
    set({ entries: d?.entries ?? [] });
  },

  save(entry) {
    const xp = letterXp(get().entries, entry.letterId);
    const entries = [...get().entries, entry];
    set({ entries });
    persist(() => db.meta.put({ key: 'letters', value: { entries } }));
    if (xp) useProgress.getState().addXp(xp);
    return xp;
  },
}));
