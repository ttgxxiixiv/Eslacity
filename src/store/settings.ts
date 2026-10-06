import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { addressHero, forGender, type Fem } from '../domain/address';
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
  /** Голоса для мужчин и женщин (путник и жители): имя голоса системы, пустое — угадать по имени (`tts.ts`). */
  voiceM: string;
  voiceF: string;
  /** Напоминание о дневной цели (задача 10.4) и его время «ЧЧ:ММ». */
  reminderOn: boolean;
  reminderTime: string;
}

export const DEFAULT_SETTINGS: Settings = { speechRate: 0.9, dailyGoal: 100, blitzBest: 0, listenOffUntil: 0, newPerDay: 10, heroGender: 'm', heroName: '', voiceM: '', voiceF: '', reminderOn: false, reminderTime: '19:00' };

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
    const { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName, voiceM, voiceF, reminderOn, reminderTime } = { ...get(), ...patch };
    persist(() =>
      db.meta.put({ key: 'settings', value: { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName, voiceM, voiceF, reminderOn, reminderTime } }),
    );
  },
}));

/** Реплика жителя с обращением к путнику по имени или в его роде; `ru` — для перевода. */
export function addressed(text: string, ru?: 'ru'): string {
  const { heroName, heroGender } = useSettings.getState();
  return addressHero(text, ru ?? LANG, { name: heroName, gender: heroGender });
}

/** Контент в роде путника: женские формы `fem` у путницы (`forGender`). */
export function byHero<T>(value: T): T {
  return forGender(value, useSettings.getState().heroGender);
}

/** Реплика жителя целиком: род путника и обращение по имени, для текста и перевода. */
export function heroText(line: { es: string; ru: string; fem?: Fem }): { es: string; ru: string } {
  const l = byHero(line);
  return { es: addressed(l.es), ru: addressed(l.ru, 'ru') };
}
