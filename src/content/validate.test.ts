import { describe, expect, it } from 'vitest';
import type { LocationWords, Word } from './schema';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateChronicler, validateGrammar, validateMissions, validateNpcs, validatePhrases, validatePortraits, validateScenes, validateScrolls, validateTranslations, validateVerbs, validateWords } from './validate';
import { LOCATION_IDS, type Chronicler, type GrammarLesson, type LocationMissions, type LocationPhrases, type LocationScenes, type Mission, type NpcsFile, type Phrase, type Scene, type ScrollFile, type VerbsFile } from './schema';

const base = (i: number, extra: Partial<Word> = {}): Word => ({
  id: `cafe.w${i}`, es: `la palabra${i}`, ru: `слово ${i}`, pos: 'noun', gender: 'f', level: 1, cefr: 'A1',
  example: { es: `Es la palabra${i}.`, ru: 'пример' }, ...extra,
});
const file = (words: Word[]) => [{ name: 'cafe.json', data: { location: 'cafe', words } as LocationWords }];
const tenWords = () => Array.from({ length: 10 }, (_, i) => base(i));
const errors = (words: Word[]) => validateWords(file(words)).filter((x) => x.level === 'error').map((x) => x.msg);

describe('validateWords', () => {
  it('уровень 6 — только B2, B1 и B2 не ниже 5-го уровня', () => {
    const six = Array.from({ length: 10 }, (_, i) => base(20 + i, { level: 6, cefr: 'B2' }));
    expect(errors([...tenWords(), ...six])).toEqual([]);
    expect(errors([...tenWords(), ...six.slice(1), base(40, { level: 6, cefr: 'B1' })])).toEqual(['у уровня 6 CEFR B2, а не B1']);
    expect(errors([...tenWords().slice(1), base(41, { cefr: 'B2' })])).toEqual(['CEFR B2 на уровне 1']);
    expect(errors([...tenWords(), ...Array.from({ length: 10 }, (_, i) => base(50 + i, { level: 7 as 6, cefr: 'B2' }))])).toContain('уровень 7');
  });
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

describe('validateGrammar: сборка и ввод формы', () => {
  const real = () =>
    JSON.parse(readFileSync(join(import.meta.dirname, 'es', 'grammar', 'a1', '02-ser.json'), 'utf8')) as GrammarLesson;
  const n = () => real().exercises.length;
  const check = (...extra: GrammarLesson['exercises']) => {
    const l = real();
    l.exercises.push(...extra.map((e, i) => ({ ...e, id: `a1.02-ser.${n() + i + 1}` })));
    return validateGrammar([{ name: 'a1/02-ser.json', data: l }], 'es').map((x) => x.msg).join('; ');
  };
  const build = { id: '', kind: 'build' as const, ru: 'Я Ана.', answer: 'Yo soy Ana.', extra: ['eres'], explain: 'ser' };
  const type = { id: '', kind: 'type' as const, sentence: 'Yo ___ Ana.', ru: 'Я Ана.', hint: 'ser', answer: 'soy', explain: 'ser' };

  it('правильные задания проходят', () => {
    expect(check(build, type, { ...build, alt: ['Ana soy yo.'] })).toBe('');
  });
  it('сборка: мало слов, лишняя плитка из ответа, alt из других слов', () => {
    expect(check({ ...build, answer: 'Soy Ana.' })).toMatch(/в сборке 2 слов, нужно 3–12/);
    expect(check({ ...build, extra: ['soy'] })).toMatch(/лишняя плитка «soy» есть в ответе/);
    expect(check({ ...build, extra: [] })).toMatch(/лишних плиток 0/);
    expect(check({ ...build, extra: ['eres tú'] })).toMatch(/не одно слово/);
    expect(check({ ...build, alt: ['Yo es Ana.'] })).toMatch(/собирается не из тех же слов/);
    expect(check({ ...build, ru: '' })).toMatch(/нет перевода/);
  });
  it('ввод: пропуск, перевод, ответ', () => {
    expect(check({ ...type, sentence: 'Yo soy Ana.' })).toMatch(/0 пропусков/);
    expect(check({ ...type, answer: '' })).toMatch(/пустой ответ/);
    expect(check({ ...type, answer: 'he sido muy muy' })).toMatch(/длиннее трёх слов/);
    expect(check({ ...type, ru: '' })).toMatch(/нет перевода/);
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

describe('фразы мест: контент', () => {
  // У каждого из 20 мест по 5 фраз на каждый уровень 1–5 в обоих языках (задача 4.2).
  const DONE = LOCATION_IDS;
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

describe('validateScenes', () => {
  const scene = (extra: Partial<Scene> = {}): Scene => ({
    id: 'sc:cafe.1', chapter: 1, npc: 'lola',
    lines: [{ who: 'npc', es: 'Hola, ¿un café?', ru: 'Привет, кофе?' }, { who: 'hero', es: 'Sí, gracias.', ru: 'Да, спасибо.' }],
    questions: [{ q: 'Что будет герой?', options: ['Кофе', 'Чай'], answer: 0 }],
    ...extra,
  });
  const residents = { cafe: 'lola', market: 'rosa', gym: 'sara' };
  const pitch = { lola: 1.2, rosa: 1.1, sara: 1.2 };
  const run = (sc: Scene, coverage?: (t: string) => { total: number; unknown: string[] }) =>
    validateScenes([{ name: 'cafe.json', data: { location: 'cafe', scenes: [sc] } as LocationScenes }], { residents, pitch, coverage });
  const errs = (sc: Scene) => run(sc).issues.filter((x) => x.level === 'error').map((x) => x.msg).join('; ');

  it('чистая сцена без ошибок', () => {
    expect(run(scene()).issues).toEqual([]);
  });
  it('id, глава, житель, реплики, вопросы', () => {
    expect(errs(scene({ id: 'cafe.1' }))).toMatch(/id должен быть "sc:cafe\.1"/);
    expect(errs(scene({ npc: 'rosa' }))).toMatch(/в этом месте живёт "lola"/);
    expect(errs(scene({ lines: [{ who: 'hero', es: 'Hola', ru: 'Привет' }, { who: 'ghost', es: 'x', ru: '' }] }))).toMatch(/житель не говорит.*кто говорит: "ghost".*пустая реплика/);
    expect(errs(scene({ questions: [{ q: 'Что?', options: ['Кофе'], answer: 3 }] }))).toMatch(/2–4 разных варианта.*ответ 3/);
    expect(errs(scene({ lines: [{ who: 'rosa', es: 'Hola', ru: 'Привет' }, { who: 'npc', es: 'Hola', ru: 'Привет' }] }))).toBe('');
  });
  it('незнакомых больше 7% — ошибка, без перевода в gloss — предупреждение', () => {
    const cov = () => ({ total: 20, unknown: ['hola', 'hola'] });
    const r = run(scene(), cov);
    expect(r.issues.map((x) => x.msg)).toEqual(['незнакомых слов 10% (hola), не больше 7%', 'нет в словаре уровня 2 и в gloss: hola']);
    expect(r.report).toEqual({ scenes: 1, whispers: 0, words: 20, unknown: 2 });
    expect(run(scene({ gloss: { hola: 'привет' } }), () => ({ total: 30, unknown: ['hola'] })).issues).toEqual([]);
  });
  it('лишнее слово в gloss — предупреждение', () => {
    expect(run(scene({ gloss: { adiós: 'пока' } })).issues[0].msg).toMatch(/слова "adiós" из gloss нет/);
  });
  it('слово после апострофа элизии есть в репликах, как на экране сцены', () => {
    const lines = [{ who: 'npc', es: "La mappa porta al Caveau dell'Elisir.", ru: 'Карта ведёт к Хранилищу Эликсира.' }, { who: 'hero', es: 'Sì.', ru: 'Да.' }];
    expect(run(scene({ lines, gloss: { elisir: 'Эликсир', "dell'": 'из' } })).issues).toEqual([]);
  });
});

describe('validateScenes: шёпоты', () => {
  const residents = { cafe: 'lola', market: 'rosa', gym: 'sara' };
  const pitch = { lola: 1.2, rosa: 1.1, sara: 1.2 };
  const stance = (q: string) => ({ q, options: ['Да', 'Нет'], answer: 0, kind: 'stance' as const });
  const talk = (a: string, b: string) => [a, b, a, b, a, b].map((who, i) => ({ who, es: `Frase ${i}.`, ru: `Фраза ${i}.` }));
  const whisper = (extra: Partial<Scene> = {}): Scene => ({
    id: 'wh:cafe.4', chapter: 4, mode: 'overhear', npc: 'lola',
    lines: talk('npc', 'rosa'),
    questions: [stance('Кто согласен?'), stance('Кто недоволен?'), stance('Что имела в виду Роза?')],
    ...extra,
  });
  const run = (sc: Scene) => validateScenes([{ name: 'cafe.json', data: { location: 'cafe', scenes: [sc] } as LocationScenes }], { residents, pitch });
  const errs = (sc: Scene) => run(sc).issues.filter((x) => x.level === 'error').map((x) => x.msg).join('; ');

  it('чистый шёпот без ошибок, в отчёте отдельно', () => {
    const r = run(whisper());
    expect(r.issues).toEqual([]);
    expect(r.report.whispers).toBe(1);
  });
  it('id wh:, глава IV, вид сцены', () => {
    expect(errs(whisper({ id: 'sc:cafe.4' }))).toMatch(/id должен быть "wh:cafe\.4"/);
    expect(errs(whisper({ id: 'wh:cafe.3', chapter: 3 }))).toMatch(/шёпоты бывают в главе 4/);
    expect(errs(whisper({ mode: 'loud' as 'overhear' }))).toMatch(/вид сцены "loud"/);
  });
  it('говорят двое, герой молчит, голоса разные', () => {
    expect(errs(whisper({ lines: [...talk('npc', 'rosa'), { who: 'hero', es: 'Hola.', ru: 'Привет.' }] }))).toMatch(/герой только слушает/);
    expect(errs(whisper({ lines: [...talk('npc', 'rosa'), { who: 'sara', es: 'Hola.', ru: 'Привет.' }] }))).toMatch(/говорят двое/);
    expect(errs(whisper({ lines: talk('npc', 'npc') }))).toMatch(/говорят двое/);
    expect(errs(whisper({ lines: talk('npc', 'lola') }))).toMatch(/говорят двое/);
    expect(errs(whisper({ lines: talk('npc', 'sara') }))).toMatch(/у "lola" и "sara" одинаковая высота голоса 1\.2/);
    const lines = talk('npc', 'rosa').map((l) => ({ ...l, who: 'npc' }));
    lines[5] = { ...lines[5], who: 'rosa' };
    expect(errs(whisper({ lines }))).toMatch(/"rosa" говорит меньше двух реплик/);
  });
  it('мало реплик и вопросов, вопросы только stance и только в шёпоте', () => {
    expect(errs(whisper({ lines: talk('npc', 'rosa').slice(0, 4) }))).toMatch(/меньше 6 реплик/);
    expect(errs(whisper({ questions: [stance('А?'), { q: 'Б?', options: ['Да', 'Нет'], answer: 1 }] }))).toMatch(/вопрос 2: в шёпоте вопросы вида stance|меньше 3 вопросов/);
    const plain: Scene = { id: 'sc:cafe.1', chapter: 1, npc: 'lola', lines: [{ who: 'npc', es: 'Hola.', ru: 'Привет.' }, { who: 'hero', es: 'Hola.', ru: 'Привет.' }], questions: [stance('А?')] };
    expect(errs(plain)).toMatch(/вид вопроса "stance" бывает только у шёпота/);
  });
});

describe('validateMissions', () => {
  const phrases = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `ph:cafe.${x}`, es: x, ru: x, level: i < 4 ? 1 : 3 }));
  const answer = (x: string, next: string) => ({ kind: 'answer' as const, task: 'Скажите', branches: [{ phrase: `ph:cafe.${x}`, next }], wrong: { es: '¿Qué?', ru: 'Что?' } });
  const mission = (extra: Partial<Mission> = {}): Mission => ({
    id: 'ms:cafe.1', chapter: 1, npc: 'lola', scene: 'sc:cafe.1', start: 'hi',
    nodes: {
      hi: { kind: 'say', es: 'Hola', ru: 'Привет', next: 'q1' },
      q1: answer('a', 'q2'), q2: answer('b', 'q3'), q3: answer('c', 'q4'), q4: answer('d', 'q5'), q5: answer('a', 'bye'),
      bye: { kind: 'say', es: 'Adiós', ru: 'Пока' },
    },
    ...extra,
  });
  const run = (m: Mission) =>
    validateMissions([{ name: 'cafe.json', data: { location: 'cafe', missions: [m] } as LocationMissions }], {
      residents: { cafe: 'lola' }, phrases: { cafe: phrases }, scenes: new Set(['sc:cafe.1']),
    }).map((x) => x.msg).join('; ');

  it('чистая миссия без ошибок', () => {
    expect(run(mission())).toBe('');
  });
  it('id, житель, сцена', () => {
    expect(run(mission({ id: 'cafe.1', npc: 'x', scene: 'sc:cafe.2' }))).toMatch(/id должен быть.*житель "x".*нет сцены "sc:cafe\.2"/);
  });
  it('фраза чужая или выше уровня главы, нет реакции, мало ответов', () => {
    const m = mission();
    m.nodes.q1 = { ...answer('zzz', 'q2') };
    m.nodes.q2 = { ...answer('e', 'q3'), wrong: { es: '', ru: '' } };
    const e = run(m);
    expect(e).toMatch(/нет фразы "ph:cafe\.zzz"/);
    expect(e).toMatch(/фраза "ph:cafe\.e" уровня 3, в главе I — до 2/);
    expect(e).toMatch(/нет реакции жителя на ошибку/);
    const short = mission();
    short.nodes = { hi: short.nodes.hi, q1: answer('a', 'bye'), bye: short.nodes.bye };
    expect(run(short)).toMatch(/ответов героя 1, нужно не меньше 5/);
  });
  it('обрыв графа — ошибка', () => {
    const m = mission();
    m.nodes.q5 = answer('a', 'nowhere');
    expect(run(m)).toMatch(/ведёт в несуществующий "nowhere"/);
  });
  it('настоящие миссии обоих языков проходят', () => {
    for (const lang of ['es', 'it']) {
      const data = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'missions', 'cafe.json'), 'utf8')) as LocationMissions;
      const ph = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'phrases', 'cafe.json'), 'utf8')) as LocationPhrases;
      const out = validateMissions([{ name: 'cafe.json', data }], {
        residents: { cafe: data.missions[0].npc }, phrases: { cafe: ph.phrases },
        scenes: new Set((JSON.parse(readFileSync(join(import.meta.dirname, lang, 'scenes', 'cafe.json'), 'utf8')) as LocationScenes).scenes.map((sc) => sc.id)),
      });
      expect(out).toEqual([]);
    }
  });
});

describe('сцены и миссии глав I–III: контент', () => {
  // У каждого из 20 мест в обоих языках есть сцена и сюжетная миссия глав I, II и III с жителем этого места (задачи 4.6 и 4.7).
  it('у каждого места сцены и миссии глав 1–3', () => {
    for (const lang of ['es', 'it']) {
      const npcs = (JSON.parse(readFileSync(join(import.meta.dirname, lang, 'npcs.json'), 'utf8')) as NpcsFile).npcs;
      for (const loc of LOCATION_IDS) {
        const scenes = (JSON.parse(readFileSync(join(import.meta.dirname, lang, 'scenes', `${loc}.json`), 'utf8')) as LocationScenes).scenes;
        const missions = (JSON.parse(readFileSync(join(import.meta.dirname, lang, 'missions', `${loc}.json`), 'utf8')) as LocationMissions).missions;
        const npc = npcs.find((n) => n.location === loc)?.id;
        for (const ch of [1, 2, 3]) {
          expect(scenes.find((s) => s.id === `sc:${loc}.${ch}`)?.npc, `${lang}/${loc}.${ch}`).toBe(npc);
          expect(missions.find((m) => m.id === `ms:${loc}.${ch}`)?.scene, `${lang}/${loc}.${ch}`).toBe(`sc:${loc}.${ch}`);
        }
      }
    }
  });
});

describe('validateVerbs', () => {
  const real = (lang: 'es' | 'it') => JSON.parse(readFileSync(join(__dirname, lang, 'verbs.json'), 'utf8')) as VerbsFile;
  const msgs = (f: VerbsFile, lang: 'es' | 'it') => validateVerbs(f, lang).map((x) => x.msg);
  it('настоящие глаголы обоих языков проходят', () => {
    expect(msgs(real('es'), 'es')).toEqual([]);
    expect(msgs(real('it'), 'it')).toEqual([]);
  });
  it('правильная строка, записанная руками, — ошибка; неверная длина и чужое время тоже', () => {
    const f = real('es');
    f.verbs.push(
      { inf: 'charlar', ru: 'болтать', forms: { presente: ['charlo', 'charlas', 'charla', 'charlamos', 'charláis', 'charlan'] } },
      { inf: 'pintar', ru: 'рисовать', pp: 'pintado', forms: { futuro: ['pintaré'], passato: ['a', 'b', 'c', 'd', 'e', 'f'] } },
    );
    expect(msgs(f, 'es')).toEqual([
      'presente: совпадает с правильной формой, запись не нужна',
      'причастие pp совпадает с правильным, запись не нужна',
      'futuro: нужно 6 непустых форм',
      'неизвестное время "passato"',
    ]);
  });
  it('мало глаголов, дубль, окончание, кузнец без приветствия', () => {
    const f = real('it');
    f.verbs = [...f.verbs.slice(0, 58), f.verbs[0], { inf: 'fare2', ru: '' }];
    f.smith = { ...f.smith, greeting: { es: '', ru: '' } };
    expect(msgs(f, 'it')).toEqual([
      'пустое приветствие',
      'дубль глагола',
      'инфинитив с неожиданным окончанием',
      'нет перевода',
      'глаголов 59, нужно не меньше 60',
    ]);
  });
});

describe('уровень 6 (B2): контент', () => {
  it('в каждом из 20 мест обоих языков по 30 слов B2', () => {
    for (const lang of ['es', 'it']) {
      for (const loc of LOCATION_IDS) {
        const words = (JSON.parse(readFileSync(join(__dirname, lang, 'words', `${loc}.json`), 'utf8')) as LocationWords).words;
        const six = words.filter((w) => w.level === 6);
        expect(six, `${lang}/${loc}`).toHaveLength(30);
        expect(six.every((w) => w.cefr === 'B2')).toBe(true);
      }
    }
  });
});

describe('validateTranslations', () => {
  const place = (location: string, words: Word[]) => ({ name: `${location}.json`, data: { location, words } as LocationWords });
  const w = (id: string, ru: string, level = 1) => base(0, { id, ru, level: level as Word['level'] });
  it('одинаковый перевод в разных местах и в свитке — предупреждение', () => {
    const scroll = { name: '1.json', data: { chapter: 1, words: [w('scroll1.x', 'Размер ')] } as ScrollFile };
    const out = validateTranslations([place('clothes', [w('clothes.talla', 'размер')]), place('supermarket', [w('supermarket.tamano', 'размер')])], [scroll]);
    expect(out.map((i) => `${i.where}: ${i.msg}`)).toEqual([
      'supermarket.json supermarket.tamano: тот же перевод «размер», что у clothes.talla',
      'scrolls/1.json scroll1.x: тот же перевод «Размер », что у clothes.talla',
    ]);
  });
  it('внутри одного уровня места о повторе сообщает validateWords, здесь его нет; разные уровни — есть', () => {
    expect(validateTranslations([place('cafe', [w('cafe.a', 'кофе'), w('cafe.b', 'кофе')])], [])).toEqual([]);
    expect(validateTranslations([place('cafe', [w('cafe.a', 'кофе'), w('cafe.b', 'кофе', 2)])], [])).toHaveLength(1);
  });
  it('в настоящем контенте обоих языков совпадений нет', () => {
    for (const lang of ['es', 'it']) {
      const dir = join(__dirname, lang);
      const places = LOCATION_IDS.map((loc) => ({ name: `${loc}.json`, data: JSON.parse(readFileSync(join(dir, 'words', `${loc}.json`), 'utf8')) as LocationWords }));
      const scrolls = [1, 2, 3].map((ch) => ({ name: `${ch}.json`, data: JSON.parse(readFileSync(join(dir, 'scrolls', `${ch}.json`), 'utf8')) as ScrollFile }));
      expect(validateTranslations(places, scrolls).map((i) => i.msg), lang).toEqual([]);
    }
  });
});

describe('validatePortraits', () => {
  const look = (portrait?: string) => ({ skin: 1, hair: '#000000', style: 'short', outfit: '#000000', pants: '#000000', extra: [], portrait }) as NpcsFile['npcs'][number]['look'];
  it('портрет без картинки или с неверным именем — ошибка, без поля — пиксельный, проверять нечего', () => {
    const out = validatePortraits(
      [{ where: 'a', look: look('lola') }, { where: 'b', look: look('nope') }, { where: 'c', look: look('Lola!') }, { where: 'd', look: look() }, { where: 'e' }],
      (name) => name === 'lola',
    );
    expect(out.map((i) => `${i.where}: ${i.msg}`)).toEqual([
      'b: нет картинки портрета nope.webp',
      'c: имя портрета "Lola!": только строчные латинские буквы и цифры',
    ]);
  });
  it('у всех испанских персонажей портреты есть, у итальянских их пока нет', () => {
    for (const lang of ['es', 'it']) {
      const npcs = (JSON.parse(readFileSync(join(__dirname, lang, 'npcs.json'), 'utf8')) as NpcsFile).npcs;
      const withArt = npcs.filter((n) => n.look.portrait).length;
      expect(withArt, lang).toBe(lang === 'es' ? 20 : 0);
      const files = new Set(npcs.map((n) => n.look.portrait).filter(Boolean));
      expect(validatePortraits(npcs.map((n) => ({ where: n.id, look: n.look })), (name) => files.has(name) && existsSync(join(__dirname, '..', 'assets', 'portraits', lang, `${name}.webp`)))).toEqual([]);
    }
  });
});
