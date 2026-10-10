import { describe, expect, it } from 'vitest';
import type { DiaryEntry, Scene } from '../content/schema';
import { validateDiary } from '../content/validate';
import { diaryProgress, entryOpen, fullChapters, percent, sourceKind, type DiarySources } from './diary';
import { medalGains, SECRETS } from './medals';

const entry = (id: string, from: string, line?: number): DiaryEntry => ({ id, chapter: Number(id[3]), topic: 'map', from, line, ru: 'Факт.', es: 'Hola.' });
const none: DiarySources = { scenes: new Set(), missions: new Set(), thread: new Set(), rumors: new Set() };

describe('дневник путника', () => {
  it('источник открывает запись: разговор или его миссия, Летопись, слух', () => {
    const sc = entry('dy:1.1', 'sc:cafe.1', 0);
    expect(sourceKind('sc:cafe.1')).toBe('scene');
    expect(sourceKind('th:1.open')).toBe('thread');
    expect(sourceKind('rm:1.1')).toBe('rumor');
    expect(entryOpen(sc, none)).toBe(false);
    expect(entryOpen(sc, { ...none, scenes: new Set(['sc:cafe.1']) })).toBe(true);
    // Миссия места этой главы: её вступление — тот же разговор, у начавших до дневника запись открыта.
    expect(entryOpen(sc, { ...none, missions: new Set(['ms:cafe.1']) })).toBe(true);
    expect(entryOpen(sc, { ...none, missions: new Set(['ms:cafe.2']) })).toBe(false);
    expect(entryOpen(entry('dy:1.2', 'th:1.open', 0), { ...none, thread: new Set(['th:1.open']) })).toBe(true);
    expect(entryOpen(entry('dy:1.3', 'rm:1.1'), { ...none, rumors: new Set(['rm:1.1']) })).toBe(true);
  });

  it('прогресс по главам и полные главы', () => {
    const all = [entry('dy:1.1', 'sc:cafe.1', 0), entry('dy:1.2', 'rm:1.1'), entry('dy:2.1', 'sc:cafe.2', 0)];
    const s = { ...none, rumors: new Set(['rm:1.1']), scenes: new Set(['sc:cafe.1']) };
    expect(diaryProgress(all, s)).toEqual([
      { chapter: 1, open: 2, total: 2 },
      { chapter: 2, open: 0, total: 1 },
    ]);
    expect(fullChapters(all, s)).toBe(1);
    expect(fullChapters(all, none)).toBe(0);
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBe(0);
  });

  it('тайная медаль «Страница летописи» за полную главу', () => {
    expect(SECRETS.some((x) => x.id === 'diary')).toBe(true);
    const c = { wordsSolid: 0, streakBest: 0, grammarDone: 0, blitzBest: 0, typedBest: 0, buildingLevels: 0, listenCorrect: 0, freezesUsed: 0, fragments: 0, errands: 0, friends: 0, trials: 0, echo: 0, seals: [], sphinxSeen: false, elixir: false, festivals: [] };
    const state = { lines: {}, secrets: {} };
    const ids = (n: number) => medalGains({ ...c, diaryChapters: n }, state).flatMap((g) => (g.kind === 'secret' ? [g.secret.id] : []));
    expect(ids(0)).not.toContain('diary');
    expect(ids(1)).toContain('diary');
  });
});

describe('validateDiary', () => {
  const scene: Scene = {
    id: 'sc:cafe.1',
    chapter: 1,
    npc: 'lola',
    lines: [
      { who: 'npc', es: 'Hola.', ru: 'Привет.' },
      { who: 'hero', es: 'Hola, Lola.', ru: 'Привет, Лола.' },
      { who: 'npc', es: 'Café.', ru: 'Кофе.', if: { flag: 'drink', is: 'coffee' } },
    ],
    questions: [],
  };
  const sources = { scenes: [scene], rumors: [{ id: 'rm:1.1', chapter: 1, es: 'Hola.' }] };
  const page = (ch: number) => Array.from({ length: 6 }, (_, i) => ({ ...entry(`dy:${ch}.${i + 1}`, 'sc:cafe.1', 0), chapter: ch }));
  const run = (entries: ReturnType<typeof entry>[]) => validateDiary({ entries }, sources).map((i) => i.msg);

  it('цитата совпадает с репликой, источник не повторяется', () => {
    const one = [entry('dy:1.1', 'sc:cafe.1', 0), entry('dy:1.2', 'rm:1.1')];
    expect(run(one).filter((m) => !m.startsWith('записей главы'))).toEqual([]);
    expect(run([{ ...entry('dy:1.1', 'sc:cafe.1', 0), es: 'Adiós.' }])).toContain('цитата не совпадает с репликой');
    expect(run([entry('dy:1.1', 'sc:cafe.1', 1)])).toContain('цитата — реплика героя');
    expect(run([entry('dy:1.1', 'sc:cafe.1', 2)])).toContain('реплика с условием: её видят не все');
    expect(run([entry('dy:1.1', 'sc:cafe.1', 9)])).toContain('нет реплики 9');
    expect(run([entry('dy:1.1', 'sc:bar.1', 0)])).toContain('нет разговора "sc:bar.1"');
    expect(run([entry('dy:1.1', 'rm:1.9')])).toContain('нет слуха "rm:1.9"');
    expect(run([entry('dy:1.1', 'sc:cafe.1', 0), entry('dy:1.2', 'sc:cafe.1', 0)])).toContain('источник "sc:cafe.1#0" уже у другой записи');
  });

  it('записей на главу не меньше шести', () => {
    const msgs = run(page(1));
    expect(msgs).toContain('записей главы 2: 0, нужно не меньше 6');
    expect(msgs).not.toContain('записей главы 1: 6, нужно не меньше 6');
  });
});
