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

describe('validateWords, итальянский', () => {
  const it10 = (first: Partial<Word>) =>
    Array.from({ length: 10 }, (_, i) =>
      base(i, { es: `la parola${i}`, example: { es: `È la parola${i}.`, ru: 'пример' }, ...(i === 0 ? first : {}) }),
    );
  const itErrors = (words: Word[]) => validateWords(file(words), 'it').filter((x) => x.level === 'error').map((x) => x.msg);
  it('чистый контент без ошибок', () => {
    expect(itErrors(it10({}))).toEqual([]);
  });
  it('l\' перед гласной, lo перед s+согласной', () => {
    expect(itErrors(it10({ es: 'la acqua', example: { es: "L'acqua.", ru: 'вода' } })).join()).toMatch(/нужен артикль "l'"/);
    expect(itErrors(it10({ es: 'il zucchero', gender: 'm', example: { es: 'Lo zucchero.', ru: 'сахар' } })).join()).toMatch(/нужен артикль "lo"/);
    expect(itErrors(it10({ es: "l'acqua", example: { es: "L'acqua è fredda.", ru: 'вода' } }))).toEqual([]);
  });
});
