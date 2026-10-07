import { describe, expect, it } from 'vitest';
import { beats, loudest, noteFreq, parseNotes, SFX, sfxLength, THEMES, themeFor, type SfxKind } from './chiptune';

describe('музыка и звуки кодом (задача 13.3)', () => {
  it('частоты нот', () => {
    expect(noteFreq('A4')).toBe(440);
    expect(noteFreq('A5')).toBeCloseTo(880);
    expect(noteFreq('C4')).toBeCloseTo(261.63, 1);
    expect(noteFreq('F#5')).toBeCloseTo(noteFreq('Gb5'));
    expect(() => noteFreq('H2')).toThrow();
  });
  it('строка нот: длительность, паузы, такты', () => {
    expect(parseNotes('A4:2 R | C5')).toEqual([{ freq: 440, len: 2 }, { freq: 0, len: 1 }, { freq: noteFreq('C5'), len: 1 }]);
    expect(() => parseNotes('A4:0')).toThrow();
  });
  it('у каждой темы мелодия и бас одной длины: восемь тактов по восемь восьмых', () => {
    for (const [id, th] of Object.entries(THEMES)) {
      expect(beats(parseNotes(th.lead)), `${id} lead`).toBe(64);
      expect(beats(parseNotes(th.bass)), `${id} bass`).toBe(64);
      expect(th.bpm, id).toBeGreaterThan(60);
    }
  });
  it('тема по месту', () => {
    expect(themeFor('/', 3, false)).toBe('city');
    expect(themeFor('/loc/cafe', 3, false)).toBe('city');
    expect(themeFor('/journey-map', 3, false)).toBe('land3');
    expect(themeFor('/guardian/2', 2, false)).toBe('land2');
    expect(themeFor('/journey-map', 5, true)).toBe('vault');
    expect(themeFor('/vault', 5, false)).toBe('vault');
  });
  it('звуки короткие, важный звук перекрывает остальные', () => {
    for (const k of Object.keys(SFX) as SfxKind[]) expect(sfxLength(k), k).toBeLessThan(1);
    expect(loudest(['coins', 'shard', 'level'])).toBe('level');
    expect(loudest(['coins'])).toBe('coins');
    expect(loudest([])).toBeNull();
  });
});
