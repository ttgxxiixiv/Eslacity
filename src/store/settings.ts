import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { addressHero } from '../domain/address';
import { LANG } from '../lang';

export interface Settings {
  speechRate: number;
  dailyGoal: 50 | 100 | 150 | 250;
  blitzBest: number;
  /** До какого момента задания на слух заменяются обычными («Не могу слушать»). */
  listenOffUntil: number;
  /** Сколько новых слов в день просят жители. Мягкий лимит: учить дальше можно всегда. */
  newPerDay: 5 | 10 | 15 | 20;
  /** Пол путника: каким голосом звучат его реплики в миссиях и сценах. */
  heroGender: 'm' | 'f';
  /** Имя путника: им жители зовут героя вместо «viajero» / «viaggiatore» (`addressHero`). Пустое — имени нет. */
  heroName: string;
}

export const DEFAULT_SETTINGS: Settings = { speechRate: 0.9, dailyGoal: 100, blitzBest: 0, listenOffUntil: 0, newPerDay: 10, heroGender: 'm', heroName: '' };

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
    const { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName } = { ...get(), ...patch };
    persist(() => db.meta.put({ key: 'settings', value: { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName } }));
  },
}));

/** Реплика жителя с обращением к путнику по имени или в его роде; `ru` — для перевода. */
export function addressed(text: string, ru?: 'ru'): string {
  const { heroName, heroGender } = useSettings.getState();
  return addressHero(text, ru ?? LANG, { name: heroName, gender: heroGender });
}
