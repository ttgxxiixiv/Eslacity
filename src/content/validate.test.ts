import { describe, expect, it } from 'vitest';
import type { LocationWords, Word } from './schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateGrammar, validateNpcs, validateWords } from './validate';
import { LOCATION_IDS, type GrammarLesson, type NpcsFile } from './schema';

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

describe('validateWords, план словаря', () => {
  const all = (words: Word[]) => validateWords(file(words));
  it('уровень 1 больше 12 слов — предупреждение, уровень 5 до 30 — можно', () => {
    const w = Array.from({ length: 13 }, (_, i) => base(i));
    expect(all(w).filter((x) => x.level === 'warning').map((x) => x.msg).join()).toMatch(/по плану не больше 12/);
    const five = Array.from({ length: 30 }, (_, i) => base(i, { level: 5, cefr: 'B1' }));
    expect(all(five).filter((x) => /по плану|нужно/.test(x.msg))).toEqual([]);
  });
  it('меньше 10 слов в уровне — ошибка', () => {
    expect(errors(Array.from({ length: 9 }, (_, i) => base(i))).join()).toMatch(/не меньше 10/);
  });
});

describe('validateNpcs', () => {
  const npc = (location: string, id = location) => ({
    id, name: 'Имя', location, role: 'роль', gender: 'f', character: 'характер',
    greeting: { es: '¡Hola!', ru: 'Привет!' }, voice: { pitch: 1, rate: 1 },
    warm: [{ es: 'a', ru: 'а' }, { es: 'b', ru: 'б' }, { es: 'c', ru: 'в' }],
    errands: location === 'school' ? ['a {n} {правил}', 'b {n} {правил}', 'c {n} {правил}'] : ['a {n} {слов}', 'b {n} {слов}', 'c {n} {слов}'],
    look: { skin: 2, hair: '#112233', style: 'bun', outfit: '#445566', pants: '#778899', extra: ['apron'] },
  });
  const all = () => LOCATION_IDS.map((l) => npc(l));
  const errs = (npcs: unknown[]) => validateNpcs({ npcs } as NpcsFile).map((x) => x.msg).join('; ');

  it('по жителю на каждое место — без ошибок', () => {
    expect(validateNpcs({ npcs: all() } as NpcsFile)).toEqual([]);
  });
  it('пропущенное место, дубль места и id', () => {
    const list = all().slice(1);
    expect(errs(list)).toMatch(/в месте cafe нет жителя/);
    expect(errs([...all(), npc('cafe', 'x')])).toMatch(/уже живёт/);
    expect(errs([...all().slice(1), npc('cafe', 'market')])).toMatch(/дубль id/);
  });
  it('голос, портрет и пустые поля', () => {
    const list = all();
    list[0] = { ...npc('cafe'), voice: { pitch: 3, rate: 1 } };
    list[1] = { ...npc('market'), look: { ...npc('market').look, extra: ['crown'] } };
    list[2] = { ...npc('supermarket'), name: ' ', greeting: { es: '', ru: 'x' } };
    const e = errs(list);
    expect(e).toMatch(/голос вне пределов/);
    expect(e).toMatch(/неизвестная деталь портрета "crown"/);
    expect(e).toMatch(/пустое поле name/);
    expect(e).toMatch(/пустое приветствие/);
    const few = all();
    few[0] = { ...npc('cafe'), errands: ['a {n} {слов}', 'без числа'] };
    expect(errs(few)).toMatch(/формулировок поручения 2/);
    expect(errs(few)).toMatch(/поручение без \{n\}/);
  });
});

describe('validateGrammar: id упражнений', () => {
  const real = () =>
    JSON.parse(readFileSync(join(import.meta.dirname, 'es', 'grammar', 'a1', '02-ser.json'), 'utf8')) as GrammarLesson;
  const check = (l: GrammarLesson) => validateGrammar([{ name: 'a1/02-ser.json', data: l }], 'es').map((x) => x.msg).join('; ');

  it('урок из контента проходит: id проставлены по порядку', () => {
    const l = real();
    expect(l.exercises.map((e) => e.id)).toEqual(l.exercises.map((_, i) => `a1.02-ser.${i + 1}`));
    expect(check(l)).toBe('');
  });
  it('нет id, чужой вид и дубль — ошибки', () => {
    const l = real();
    delete (l.exercises[0] as Partial<GrammarLesson['exercises'][number]>).id;
    l.exercises[1].id = 'a1.03-ser-uso.2';
    l.exercises[3].id = l.exercises[2].id;
    const e = check(l);
    expect(e).toMatch(/нет id: запустите/);
    expect(e).toMatch(/не вида a1\.02-ser\.<номер>/);
    expect(e).toMatch(/дубль id a1\.02-ser\.3/);
  });
});
