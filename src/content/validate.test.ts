import { describe, expect, it } from 'vitest';
import type { LocationWords, Word } from './schema';
import { validateWords } from './validate';

const base = (i: number, extra: Partial<Word> = {}): Word => ({
  id: `cafe.w${i}`, es: `la palabra${i}`, ru: `слово ${i}`, pos: 'noun', gender: 'f', level: 1, cefr: 'A1',
  example: { es: `Es la palabra${i}.`, ru: 'пример' }, ...extra,
});
const file = (words: Word[]) => [{ name: 'cafe.json', data: { location: 'cafe', words } as LocationWords }];
const tenWords = () => Array.from({ length: 10 }, (_, i) => base(i));
const errors = (words: Word[]) => validateWords(file(words)).filter((x) => x.level === 'error').map((x) => x.msg);

describe('validateWords', () => {
  it('чистый контент без ошибок', () => {
    expect(errors(tenWords())).toEqual([]);
  });
  it('существительное без артикля', () => {
    const w = tenWords(); w[0] = base(0, { es: 'palabra0' });
    expect(errors(w).join()).toMatch(/без определённого артикля/);
  });
  it('артикль не того рода, но el agua разрешён', () => {
    const w = tenWords(); w[0] = base(0, { es: 'el palabra0' });
    expect(errors(w).join()).toMatch(/не совпадает с родом/);
    w[0] = base(0, { es: 'el agua', example: { es: 'El agua.', ru: 'вода' } });
    expect(errors(w)).toEqual([]);
  });
  it('дубли id и es', () => {
    const w = tenWords(); w.push(base(0));
    expect(errors(w).join()).toMatch(/дубль id/);
    expect(errors(w).join()).toMatch(/дубль "la palabra0"/);
  });
  it('пустые поля и число слов в уровне', () => {
    const w = tenWords(); w[1] = base(1, { ru: ' ' });
    expect(errors(w).join()).toMatch(/пустое поле ru/);
    expect(errors(tenWords().slice(0, 9)).join()).toMatch(/9 слов/);
  });
});
