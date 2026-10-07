/**
 * Музыка и звуки кодом (задача 13.3): ноты, темы земель и описание звуков. Без WebAudio — его подключают
 * `src/audio/music.ts` и `src/audio/sfx.ts`. Темы записаны строками нот: «E5:2» — ми пятой октавы на две восьмых,
 * «R:4» — пауза в четверть, «|» — граница такта для глаза. Длительность по умолчанию — одна восьмая.
 */

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

export interface NoteEvent {
  /** Частота в герцах, у паузы 0. */
  freq: number;
  /** Длительность в восьмых. */
  len: number;
}

const STEPS: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** Частота ноты «A4», «F#5», «Bb3»: равномерная темперация от ля первой октавы 440 Гц. */
export function noteFreq(name: string): number {
  const m = name.match(/^([A-G])([#b]?)(-?\d)$/);
  if (!m) throw new Error(`нота «${name}»`);
  const semis = STEPS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/** Строка нот в события. */
export function parseNotes(line: string): NoteEvent[] {
  return line
    .split(/\s+/)
    .filter((t) => t && t !== '|')
    .map((t) => {
      const [name, len = '1'] = t.split(':');
      const n = Number(len);
      if (!(n > 0)) throw new Error(`длительность «${t}»`);
      return { freq: name === 'R' ? 0 : noteFreq(name), len: n };
    });
}

export const beats = (events: NoteEvent[]) => events.reduce((s, e) => s + e.len, 0);

export interface Theme {
  /** Четвертей в минуту. */
  bpm: number;
  lead: string;
  bass: string;
  leadWave: Wave;
  bassWave: Wave;
}

export type ThemeId = 'city' | 'land1' | 'land2' | 'land3' | 'land4' | 'land5' | 'vault';

/** Темы: город и пять земель по главам, после Эликсира — Хранилище. Каждая — восемь тактов по восемь восьмых. */
export const THEMES: Record<ThemeId, Theme> = {
  // Город: до мажор, бодро.
  city: {
    bpm: 112, leadWave: 'square', bassWave: 'triangle',
    lead: 'E5:2 G5:2 C6:2 G5:2 | A5:2 F5:2 D5:4 | E5:2 G5:2 C6:2 E6:2 | D6:4 R:4 | C6:2 A5:2 F5:2 A5:2 | G5:2 E5:2 C5:4 | D5:2 F5:2 B5:2 D6:2 | C6:6 R:2',
    bass: 'C3:4 G2:4 | F2:4 G2:4 | C3:4 G2:4 | G2:8 | F2:8 | C3:8 | G2:8 | C3:8',
  },
  // Окрестности города: соль мажор, пастораль.
  land1: {
    bpm: 96, leadWave: 'square', bassWave: 'triangle',
    lead: 'B4:2 D5:2 G5:4 | F#5:2 E5:2 D5:4 | C5:2 E5:2 A5:4 | G5:6 R:2 | B4:2 D5:2 G5:2 B5:2 | A5:2 F#5:2 D5:4 | E5:2 C5:2 A4:2 F#4:2 | G4:6 R:2',
    bass: 'G2:8 | D3:8 | C3:8 | G2:8 | G2:8 | D3:8 | C3:4 D3:4 | G2:8',
  },
  // Горный перевал: ля минор, медленно, ветер.
  land2: {
    bpm: 84, leadWave: 'triangle', bassWave: 'triangle',
    lead: 'A4:4 C5:2 E5:2 | D5:4 C5:2 B4:2 | A4:2 C5:2 E5:2 A5:2 | G5:8 | F5:4 E5:2 D5:2 | E5:4 C5:2 A4:2 | B4:2 D5:2 G4:2 B4:2 | A4:8',
    bass: 'A2:8 | F2:8 | A2:8 | E2:8 | D2:8 | A2:8 | E2:8 | A2:8',
  },
  // Пустыня миражей: ре фригийский, восточный оборот.
  land3: {
    bpm: 100, leadWave: 'sawtooth', bassWave: 'triangle',
    lead: 'D5:2 D#5:2 F#5:2 G5:2 | A5:4 G5:2 F#5:2 | D#5:2 F#5:2 D5:4 | R:8 | A5:2 A#5:2 A5:2 G5:2 | F#5:4 G5:2 F#5:2 | D#5:2 D5:2 D#5:2 F#5:2 | D5:6 R:2',
    bass: 'D2:4 D2:4 | D2:4 C2:4 | D2:4 D#2:4 | D2:8 | D2:8 | C2:4 D2:4 | D#2:8 | D2:8',
  },
  // Лес шёпотов: ми минор, тихо.
  land4: {
    bpm: 88, leadWave: 'triangle', bassWave: 'sine',
    lead: 'E5:3 G5:1 B5:4 | A5:3 G5:1 F#5:4 | E5:2 D5:2 E5:2 G5:2 | F#5:8 | G5:3 A5:1 B5:4 | C6:3 B5:1 A5:4 | G5:2 F#5:2 D5:2 F#5:2 | E5:8',
    bass: 'E2:8 | D2:8 | C2:8 | B1:8 | E2:8 | A2:8 | B1:8 | E2:8',
  },
  // Лабиринт Эха: до минор, ноты повторяются, как эхо.
  land5: {
    bpm: 92, leadWave: 'square', bassWave: 'triangle',
    lead: 'C5:2 R:1 C5:1 D#5:2 R:1 D#5:1 | G5:4 F5:4 | D#5:2 R:1 D#5:1 D5:2 R:1 D5:1 | C5:8 | G#4:2 C5:2 D#5:2 G5:2 | F5:4 D#5:4 | D5:2 F5:2 G#5:2 G5:2 | C5:6 R:2',
    bass: 'C2:8 | G#1:8 | G1:8 | C2:8 | G#1:8 | F1:8 | G1:8 | C2:8',
  },
  // Хранилище: до мажор, торжественно.
  vault: {
    bpm: 76, leadWave: 'triangle', bassWave: 'triangle',
    lead: 'G4:2 C5:2 E5:2 G5:2 | A5:4 G5:4 | F5:2 E5:2 D5:2 C5:2 | D5:8 | E5:2 G5:2 C6:4 | B5:2 A5:2 G5:4 | F5:2 A5:2 D5:2 F5:2 | C5:8',
    bass: 'C3:8 | F2:8 | F2:4 G2:4 | G2:8 | C3:8 | E2:4 C2:4 | F2:4 G2:4 | C3:8',
  },
};

/** Тема по месту: карта странствий и стражи звучат землёй открытой главы, после Эликсира — Хранилищем. */
export function themeFor(path: string, opened: number, sage: boolean): ThemeId {
  const land = /^\/(journey-map|guardian|sphinx|vault|chronicle)\b/.test(path);
  if (!land) return 'city';
  if (sage || path.startsWith('/vault')) return 'vault';
  return `land${Math.min(Math.max(opened, 1), 5)}` as ThemeId;
}

export type SfxKind = 'correct' | 'almost' | 'wrong' | 'coins' | 'shard' | 'seal' | 'level';

/** Тон звука: начало и длина в секундах, частота (и куда скользит), форма волны, громкость 0–1. */
export interface Tone {
  at: number;
  dur: number;
  freq: number;
  to?: number;
  wave: Wave;
  vol: number;
}

const t = (at: number, dur: number, note: string, wave: Wave = 'square', vol = 0.5, to?: string): Tone => ({
  at, dur, freq: noteFreq(note), wave, vol, ...(to ? { to: noteFreq(to) } : {}),
});

/** Звуки: короткие, чтобы не мешать следующему заданию. */
export const SFX: Record<SfxKind, Tone[]> = {
  correct: [t(0, 0.08, 'E6'), t(0.08, 0.14, 'A6')],
  almost: [t(0, 0.1, 'G5', 'triangle', 0.6), t(0.11, 0.16, 'A5', 'triangle', 0.6)],
  wrong: [t(0, 0.28, 'A3', 'square', 0.35, 'D3')],
  coins: [t(0, 0.06, 'B5', 'square', 0.4), t(0.06, 0.24, 'E6', 'square', 0.4)],
  shard: [t(0, 0.07, 'C6'), t(0.07, 0.07, 'E6'), t(0.14, 0.07, 'G6'), t(0.21, 0.22, 'C7', 'square', 0.4)],
  seal: [
    t(0, 0.18, 'C5', 'triangle', 0.6), t(0, 0.18, 'E5', 'triangle', 0.4), t(0, 0.18, 'G5', 'triangle', 0.4),
    t(0.2, 0.5, 'C6', 'square', 0.45),
  ],
  level: [t(0, 0.1, 'G5'), t(0.1, 0.1, 'C6'), t(0.2, 0.1, 'E6'), t(0.3, 0.1, 'G6'), t(0.42, 0.45, 'C7', 'square', 0.4)],
};

/** Длина звука в секундах. */
export const sfxLength = (kind: SfxKind) => Math.max(...SFX[kind].map((x) => x.at + x.dur));

/** Самый важный из звуков одного мгновения: в конце урока монеты, обрывок и уровень приходят разом. */
const RANK: SfxKind[] = ['level', 'seal', 'shard', 'coins'];
export function loudest(kinds: SfxKind[]): SfxKind | null {
  return RANK.find((k) => kinds.includes(k)) ?? kinds[0] ?? null;
}
