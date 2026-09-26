import { describe, expect, it } from 'vitest';
import type { LocationWords, Word } from './schema';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateChronicler, validateGrammar, validateNpcs, validatePhrases, validateScrolls, validateWords } from './validate';
import { LOCATION_IDS, type Chronicler, type GrammarLesson, type LocationPhrases, type NpcsFile, type Phrase, type ScrollFile } from './schema';

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

describe('validateScrolls', () => {
  const sw = (slug: string, extra: Partial<Word> = {}): Word => ({
    id: `scroll1.${slug}`, es: `el ${slug}`, ru: slug, pos: 'noun', gender: 'm', level: 1, cefr: 'A1',
    example: { es: `Es el ${slug}.`, ru: 'пример' }, ...extra,
  });
  const scroll = (words: Word[], chapter = 1, name = `${chapter}.json`) => [{ name, data: { chapter, words } as ScrollFile }];
  const errs = (words: Word[], chapter?: number, name?: string) =>
    validateScrolls(scroll(words, chapter, name), file(tenWords())).filter((x) => x.level === 'error').map((x) => x.msg).join('; ');

  it('чистый свиток без ошибок', () => {
    expect(errs([sw('mapa'), sw('mundo')])).toBe('');
  });
  it('слово места и дубль внутри свитка — ошибки', () => {
    expect(errs([sw('x', { es: 'la palabra3', gender: 'f' })])).toMatch(/уже есть: cafe\.w3/);
    expect(errs([sw('mapa'), sw('mapa')])).toMatch(/дубль id/);
  });
  it('чужой префикс, уровень, CEFR главы и имя файла', () => {
    expect(errs([sw('mapa', { id: 'cafe.mapa' })])).toMatch(/начинаться с "scroll1\."/);
    expect(errs([sw('mapa', { level: 2 })])).toMatch(/level всегда 1/);
    expect(errs([sw('mapa', { cefr: 'A2' })])).toMatch(/у главы I — A1/);
    expect(errs([sw('mapa')], 1, '2.json')).toMatch(/имя файла/);
  });
  it('одинаковый перевод внутри свитка — предупреждение', () => {
    const warns = validateScrolls(scroll([sw('mapa'), sw('plano', { ru: 'mapa' })]), []).filter((x) => x.level === 'warning');
    expect(warns.map((x) => x.msg).join()).toMatch(/тот же перевод «mapa», что у scroll1\.mapa/);
  });
  it('слов больше плана — ошибка', () => {
    const many = Array.from({ length: 61 }, (_, i) => sw(`w${i}`));
    expect(errs(many)).toMatch(/61 слов, по плану не больше 60/);
  });
  it('настоящие свитки обоих языков проходят', () => {
    for (const lang of ['es', 'it'] as const) {
      for (const ch of [1, 2]) {
        const data = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'scrolls', `${ch}.json`), 'utf8')) as ScrollFile;
        expect(validateScrolls([{ name: `${ch}.json`, data }], [], lang)).toEqual([]);
        expect(data.words).toHaveLength(ch === 1 ? 60 : 100);
      }
    }
  });
});

describe('validateChronicler', () => {
  const real = (lang: string) => JSON.parse(readFileSync(join(import.meta.dirname, lang, 'chronicler.json'), 'utf8')) as Chronicler;
  it('Летописец обоих языков проходит', () => {
    expect(validateChronicler(real('es'), undefined)).toEqual([]);
    expect(validateChronicler(real('it'), undefined)).toEqual([]);
  });
  it('нет файла, место и занятый id — ошибки', () => {
    expect(validateChronicler(undefined, undefined)[0].msg).toMatch(/нет Летописца/);
    const n = { ...real('es'), location: 'cafe' } as Chronicler;
    expect(validateChronicler(n, undefined).map((x) => x.msg).join()).toMatch(/location лишнее/);
    const npcs = { npcs: [{ ...real('es'), location: 'cafe' }] } as NpcsFile;
    expect(validateChronicler(real('es'), npcs).map((x) => x.msg).join()).toMatch(/уже занят/);
  });
});

describe('validatePhrases', () => {
  const ph = (slug: string, es: string, extra: Partial<Phrase> = {}): Phrase => ({ id: `ph:cafe.${slug}`, es, ru: slug, level: 1, ...extra });
  const run = (phrases: Phrase[], checks = {}) =>
    validatePhrases([{ name: 'cafe.json', data: { location: 'cafe', phrases } as LocationPhrases }], checks);
  const errs = (phrases: Phrase[], checks = {}) => run(phrases, checks).filter((x) => x.level === 'error').map((x) => x.msg).join('; ');

  it('чистые фразы без ошибок', () => {
    expect(run([ph('cafe', 'Un café, por favor.'), ph('quiero', '(Yo) quiero un té.', { alt: ['Un té, por favor.'], grammar: 'a1.12' })], { lessons: new Set(['a1.12']) })).toEqual([]);
  });
  it('id, уровень, урок, пустые поля', () => {
    const e = errs([ph('a', 'Hola', { id: 'cafe.a', level: 8, grammar: 'x' }), ph('b', ' ', { ru: '' })], { lessons: new Set() });
    expect(e).toMatch(/начинаться с "ph:cafe\."/);
    expect(e).toMatch(/уровень 8/);
    expect(e).toMatch(/нет урока грамматики "x"/);
    expect(e).toMatch(/пустое поле es/);
    expect(e).toMatch(/пустое поле ru/);
  });
  it('скобки и длина', () => {
    expect(errs([ph('a', '((Yo)) quiero')])).toMatch(/вложенные скобки/);
    expect(errs([ph('a', 'uno dos tres cuatro cinco seis siete ocho nueve diez once (doce trece)')])).toMatch(/13 слов, не больше 12/);
  });
  it('вариант одной фразы совпадает с другой — ошибка, со своим alt — нет', () => {
    expect(errs([ph('a', '(Yo) quiero un té.'), ph('b', 'Quiero un té')])).toMatch(/вариант «Quiero un té» уже есть у ph:cafe\.a/);
    expect(errs([ph('a', '(Yo) quiero un té.', { alt: ['Quiero un té.'] })])).toBe('');
  });
  it('непокрытые слова — предупреждение с уровнем', () => {
    const w = run([ph('a', 'Una bicicleta roja', { level: 2 })], { uncovered: (t: string) => (t.includes('bicicleta') ? ['bicicleta'] : []) });
    expect(w).toEqual([{ level: 'warning', where: 'phrases/cafe.json#0 ph:cafe.a', msg: 'es: нет в словаре уровня 2 и ниже: bicicleta' }]);
  });
  it('образцы кафе обоих языков проходят', () => {
    for (const lang of ['es', 'it']) {
      const data = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'phrases', 'cafe.json'), 'utf8')) as LocationPhrases;
      expect(validatePhrases([{ name: 'cafe.json', data }])).toEqual([]);
    }
  });
});

describe('фразы мест: пачки контента', () => {
  // Места с готовыми фразами: по 5 на каждый уровень 1–5 в обоих языках (задача 4.2).
  const DONE = ['cafe', 'market', 'supermarket', 'restaurant', 'home'];
  it('по пять фраз на уровень, одинаково в обоих языках', () => {
    for (const lang of ['es', 'it']) {
      for (const loc of DONE) {
        const data = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'phrases', `${loc}.json`), 'utf8')) as LocationPhrases;
        const perLevel = [1, 2, 3, 4, 5].map((l) => data.phrases.filter((p) => p.level === l).length);
        expect(perLevel, `${lang}/${loc}`).toEqual([5, 5, 5, 5, 5]);
      }
    }
  });
});
