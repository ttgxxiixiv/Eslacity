import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../store/settings';
import { SETTINGS_SECTIONS, settingsHint } from './settingsSections';

const ctx = { lang: 'Испанский', textSize: 'Обычный' };

describe('разделы настроек', () => {
  it('восемь разделов из задачи 14.4, без повторов', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.title)).toEqual(['Путник', 'Обучение', 'Звук и озвучка', 'Напоминание', 'Язык курса', 'Данные и копии', 'Приложение', 'Отчёты']);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(8);
  });

  it('у каждого раздела есть подпись', () => {
    for (const s of SETTINGS_SECTIONS) expect(settingsHint(s.id, DEFAULT_SETTINGS, ctx)).not.toBe('');
  });

  it('подпись показывает выбранное', () => {
    expect(settingsHint('hero', { ...DEFAULT_SETTINGS, heroGender: 'f', heroName: 'Lucía' }, ctx)).toBe('Путница, имя Lucía');
    expect(settingsHint('learning', DEFAULT_SETTINGS, ctx)).toBe('Цель 100 XP, новых слов в день: 10');
    expect(settingsHint('sound', { ...DEFAULT_SETTINGS, musicVolume: 0 }, ctx)).toBe('Звуки 60%, музыка выкл., скорость речи 0.9');
    expect(settingsHint('reminder', DEFAULT_SETTINGS, ctx)).toBe('Выключено');
    expect(settingsHint('reminder', { ...DEFAULT_SETTINGS, reminderOn: true, reminderTime: '07:45' }, ctx)).toBe('Каждый день в 07:45');
    expect(settingsHint('app', DEFAULT_SETTINGS, { ...ctx, textSize: 'Крупный' })).toContain('крупный');
  });
});
