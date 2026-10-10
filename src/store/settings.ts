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
  /** Громкость звуков и музыки (задача 13.3), 0–1; 0 — выключено. */
  sfxVolume: number;
  musicVolume: number;
  /** Размер текста (задача 14.3): корневой размер шрифта, от него считаются все размеры в rem. */
  textSize: TextSize;
}

export type TextSize = 'normal' | 'large' | 'xlarge';

/** Корневой размер шрифта в процентах для каждого размера текста. */
export const TEXT_SCALE: Record<TextSize, number> = { normal: 100, large: 112.5, xlarge: 125 };

export const TEXT_SIZE_LABEL: Record<TextSize, string> = { normal: 'Обычный', large: 'Крупный', xlarge: 'Очень крупный' };

export const DEFAULT_SETTINGS: Settings = { speechRate: 0.9, dailyGoal: 100, blitzBest: 0, listenOffUntil: 0, newPerDay: 10, heroGender: 'm', heroName: '', voiceM: '', voiceF: '', reminderOn: false, reminderTime: '19:00', sfxVolume: 0.6, musicVolume: 0.4, textSize: 'normal' };

interface SettingsState extends Settings {
  hydrate(s: Partial<Settings> | undefined): void;
  update(patch: Partial<Settings>): void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrate(s) {
    set({ ...DEFAULT_SETTINGS, ...s });
    applyTextSize(get().textSize);
  },
  update(patch) {
    set(patch);
    if (patch.textSize) applyTextSize(patch.textSize);
    const { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName, voiceM, voiceF, reminderOn, reminderTime, sfxVolume, musicVolume, textSize } = { ...get(), ...patch };
    persist(() =>
      db.meta.put({ key: 'settings', value: { speechRate, dailyGoal, blitzBest, listenOffUntil, newPerDay, heroGender, heroName, voiceM, voiceF, reminderOn, reminderTime, sfxVolume, musicVolume, textSize } }),
    );
  },
}));

/** Размер текста — корневой размер шрифта страницы: вёрстка в rem растёт вместе с ним. */
export function applyTextSize(size: TextSize): void {
  if (typeof document !== 'undefined') document.documentElement.style.fontSize = `${TEXT_SCALE[size] ?? 100}%`;
}

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
