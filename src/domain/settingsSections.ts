import type { Settings } from '../store/settings';

/**
 * Разделы настроек (задача 14.4): оглавление `/settings` и свой экран у каждого раздела `/settings/<id>`.
 * Порядок — порядок в оглавлении: сначала то, что меняют чаще.
 */
export type SettingsSection = 'hero' | 'learning' | 'sound' | 'reminder' | 'language' | 'data' | 'app' | 'reports';

export const SETTINGS_SECTIONS: { id: SettingsSection; title: string; icon: string }[] = [
  { id: 'hero', title: 'Путник', icon: '🧭' },
  { id: 'learning', title: 'Обучение', icon: '📚' },
  { id: 'sound', title: 'Звук и озвучка', icon: '🔊' },
  { id: 'reminder', title: 'Напоминание', icon: '⏰' },
  { id: 'language', title: 'Язык курса', icon: '🌐' },
  { id: 'data', title: 'Данные и копии', icon: '💾' },
  { id: 'app', title: 'Приложение', icon: '📱' },
  { id: 'reports', title: 'Отчёты', icon: '📝' },
];

type HintSettings = Pick<Settings, 'heroGender' | 'heroName' | 'dailyGoal' | 'newPerDay' | 'sfxVolume' | 'musicVolume' | 'speechRate' | 'reminderOn' | 'reminderTime'>;

const volume = (v: number) => (v > 0 ? `${Math.round(v * 100)}%` : 'выкл.');

/** Строка под названием раздела: что там сейчас выбрано, чтобы не открывать раздел ради проверки. */
export function settingsHint(id: SettingsSection, s: HintSettings, ctx: { lang: string; textSize: string }): string {
  switch (id) {
    case 'hero':
      return `${s.heroGender === 'f' ? 'Путница' : 'Путник'}, ${s.heroName ? `имя ${s.heroName}` : 'без имени'}`;
    case 'learning':
      return `Цель ${s.dailyGoal} XP, новых слов в день: ${s.newPerDay}`;
    case 'sound':
      return `Звуки ${volume(s.sfxVolume)}, музыка ${volume(s.musicVolume)}, скорость речи ${s.speechRate.toFixed(1)}`;
    case 'reminder':
      return s.reminderOn ? `Каждый день в ${s.reminderTime}` : 'Выключено';
    case 'language':
      return `${ctx.lang}: у каждого языка свой город`;
    case 'data':
      return 'Сохранить прогресс в файл, загрузить, сбросить';
    case 'app':
      return `Размер текста: ${ctx.textSize.toLowerCase()}. Версия, APK для Android`;
    case 'reports':
      return 'Отчёты об ошибках в заданиях';
  }
}
