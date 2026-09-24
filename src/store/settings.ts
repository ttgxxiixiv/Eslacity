import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';

export interface Settings {
  speechRate: number;
  dailyGoal: 50 | 100 | 150 | 250;
  blitzBest: number;
}

export const DEFAULT_SETTINGS: Settings = { speechRate: 0.9, dailyGoal: 100, blitzBest: 0 };

interface SettingsState extends Settings {
  hydrate(s: Partial<Settings> | undefined): void;
  update(patch: Partial<Settings>): void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrate(s) {
    set({ ...DEFAULT_SETTINGS, ...s });
  },
  update(patch) {
    set(patch);
    const { speechRate, dailyGoal, blitzBest } = { ...get(), ...patch };
    persist(() => db.meta.put({ key: 'settings', value: { speechRate, dailyGoal, blitzBest } }));
  },
}));
