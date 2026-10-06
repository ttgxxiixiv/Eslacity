import { describe, expect, it } from 'vitest';
import type { Contrast, PairsFile } from '../content/schema';
import { validatePairs } from '../content/validate';
import { seeded } from './generators';
import { pairIssue, pairItemId, pairTasks, pairVerdict, retryTask } from './minimalPairs';
import es from '../content/es/pairs.json';
import it_ from '../content/it/pairs.json';

const w = (es: string, ru: string) => ({ es, ru });

describe('минимальные пары', () => {
  it('пара проверяется по своему противопоставлению', () => {
    const rr: Contrast = { id: 'r-rr', title: 'r', hint: 'h', kind: 'swap', swap: ['rr', 'r'], pairs: [] };
    expect(pairIssue(rr, [w('perro', 'собака'), w('pero', 'но')])).toBeNull();
    expect(pairIssue(rr, [w('pero', 'но'), w('perro', 'собака')])).toMatch(/заменой/);
    const stress: Contrast = { ...rr, kind: 'stress', swap: undefined };
    expect(pairIssue(stress, [w('papá', 'папа'), w('papa', 'картошка')])).toBeNull();
    expect(pairIssue(stress, [w('papá', 'папа'), w('pipa', 'трубка')])).toMatch(/не только ударением/);
    const double: Contrast = { ...rr, kind: 'double', swap: undefined };
    expect(pairIssue(double, [w('palla', 'мяч'), w('pala', 'лопата')])).toBeNull();
    expect(pairIssue(double, [w('zoo', 'зоопарк'), w('zo', '?')])).toMatch(/двойной согласной/);
    expect(pairIssue(double, [w('palla', 'мяч'), w('palla', 'мяч')])).toMatch(/одинаковые/);
  });

  it('контент обоих языков проходит проверку', () => {
    expect(validatePairs(es as PairsFile)).toEqual([]);
    expect(validatePairs(it_ as PairsFile)).toEqual([]);
  });

  it('звон: пары не повторяются, пока не кончились; ошибка возвращает пару с другим словом', () => {
    const file = es as PairsFile;
    const tasks = pairTasks(file.contrasts, 10, seeded(7));
    expect(tasks).toHaveLength(10);
    expect(new Set(tasks.map((t) => pairItemId(t.contrast, t.pair))).size).toBe(10);
    const t = tasks[0];
    expect(pairVerdict(t, t.target)).toBe('correct');
    expect(pairVerdict(t, t.target === 0 ? 1 : 0)).toBe('wrong');
    expect(retryTask(t).target).not.toBe(t.target);
    // Одно противопоставление: пар меньше, чем заданий, — идут по кругу.
    const one = pairTasks([file.contrasts[1]], 10, seeded(3));
    expect(one).toHaveLength(10);
  });
});
