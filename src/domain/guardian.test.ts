import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GrammarExercise, Word } from '../content/schema';
import { seeded } from './generators';
import {
  buildGuardian, GUARDIAN_KIND_MIN, GUARDIAN_KINDS, GUARDIAN_MIX, GUARDIAN_SIZE, guardianId, isGuardianDone, isGuardianPassed, parseGuardianId,
} from './guardian';
import { trialsPassed } from './trial';

const word = (id: string): Word => ({ id, es: `palabra ${id}`, ru: `слово ${id}`, pos: 'noun', level: 1, cefr: 'A1', example: { es: 'x', ru: 'x' } });
const words = Array.from({ length: 30 }, (_, i) => word(`cafe.w${i}`));
const scroll = Array.from({ length: 10 }, (_, i) => word(`scroll1.s${i}`));
// 15 уроков по 3 упражнения.
const exercises: GrammarExercise[] = Array.from({ length: 15 }, (_, l) =>
  [1, 2, 3].map((n): GrammarExercise => ({ id: `a1.l${l}.${n}`, kind: 'truefalse', statement: `s${l}.${n}`, answer: true, explain: '' })),
).flat();

const ids = (items: ReturnType<typeof buildGuardian>) =>
  items.map((i) => (i.kind === 'grammar' ? i.item.ex.id : i.kind === 'word' ? (i.step as { wordId: string }).wordId : i.step.id));

describe('испытание стража', () => {
  it('20 заданий: 12 грамматики из разных уроков, 5 слов главы, 3 слова свитка, без повторов', () => {
    const items = buildGuardian(exercises, words, scroll, words, seeded(1));
    expect(items).toHaveLength(GUARDIAN_SIZE);
    const gr = items.filter((i) => i.kind === 'grammar');
    expect(gr).toHaveLength(GUARDIAN_MIX.grammar);
    // Уроков больше, чем заданий грамматики: каждое — из своего урока.
    expect(new Set(gr.map((i) => (i.kind === 'grammar' ? i.item.ex.id.split('.').slice(0, 2).join('.') : ''))).size).toBe(12);
    const all = ids(items);
    expect(all.filter((id) => id.startsWith('cafe.'))).toHaveLength(GUARDIAN_MIX.words);
    expect(all.filter((id) => id.startsWith('scroll1.'))).toHaveLength(GUARDIAN_MIX.scroll);
    expect(new Set(all).size).toBe(GUARDIAN_SIZE);
  });
  it('свитка нет — его места занимают слова главы; слова на слух у стража леса', () => {
    const items = buildGuardian(exercises, words, [], words, seeded(2), { listen: true });
    expect(ids(items).filter((id) => id.startsWith('cafe.'))).toHaveLength(8);
    expect(items.filter((i) => i.kind === 'word').every((i) => i.kind === 'word' && i.step.kind.startsWith('listen'))).toBe(true);
  });
  it('мало уроков — грамматика берёт по нескольку упражнений из урока', () => {
    const items = buildGuardian(exercises.slice(0, 6), words, scroll, words, seeded(3));
    expect(items).toHaveLength(14);
    expect(items.filter((i) => i.kind === 'grammar')).toHaveLength(6);
  });
  it('Хозяин Эха: найти ошибку, сменить тон и перефразировать — не меньше двух заданий каждого вида', () => {
    // Упражнения настоящего района C1.
    const kinds = GUARDIAN_KINDS[5]!;
    const dir = join(import.meta.dirname, '..', 'content', 'es', 'grammar', 'c1');
    const c1 = readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { exercises: GrammarExercise[] }).exercises);
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildGuardian(c1, words, scroll, words, seeded(seed), { kinds });
      const gr = items.flatMap((i) => (i.kind === 'grammar' ? [i.item.ex] : []));
      expect(gr).toHaveLength(GUARDIAN_MIX.grammar);
      for (const k of kinds) expect(gr.filter((e) => e.kind === k).length).toBeGreaterThanOrEqual(GUARDIAN_KIND_MIN);
      expect(new Set(gr.map((e) => e.id)).size).toBe(gr.length);
    }
  });
  it('порог 75%, id и учёт в «Испытателе»', () => {
    expect(isGuardianPassed(15, 0, 20)).toBe(true);
    expect(isGuardianPassed(13, 2, 20)).toBe(true);
    expect(isGuardianPassed(14, 0, 20)).toBe(false);
    expect(guardianId(2)).toBe('gd:2');
    expect(parseGuardianId('gd:2')).toBe(2);
    expect(parseGuardianId('tr:cafe.2')).toBeNull();
    const records = { 'gd:1': { attempts: 1, best: 0.9, done: 5 }, 'tr:cafe.1': { attempts: 1, best: 1, done: 5 } };
    expect(isGuardianDone(records, 1)).toBe(true);
    expect(isGuardianDone(records, 2)).toBe(false);
    expect(trialsPassed(records)).toBe(2);
  });
});
