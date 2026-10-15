import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LocationWords, ScrollFile } from '../../content/schema';
import { CHAPTERS } from '../../content/vocabPlan';
import { checkTyped, lowerText, normalizeIn, stripAccents } from '../../domain/answer';
import { A, I, analyze, conjugate, noun, soften, verbOf } from './morph';
import { TR } from '.';

const v = (inf: string, extra: { soft?: boolean; aorist?: 'I' | 'A' } = {}) => verbOf(inf, extra)!;

describe('гармония гласных и стык', () => {
  it('двух- и четырёхвариантная гармония по последней гласной', () => {
    expect(['ev', 'okul', 'göz', 'kapı'].map((s) => A(s))).toEqual(['e', 'a', 'e', 'a']);
    expect(['ev', 'okul', 'göz', 'kapı', 'gün', 'kız'].map((s) => I(s))).toEqual(['i', 'u', 'ü', 'ı', 'ü', 'ı']);
  });

  it('озвончение конечной согласной: p → b, ç → c, t → d, k → ğ, nk → ng', () => {
    expect(['kitap', 'ağaç', 'dört', 'ekmek', 'renk'].map(soften)).toEqual(['kitab', 'ağac', 'dörd', 'ekmeğ', 'reng']);
  });
});

describe('существительное', () => {
  it('множественное и падежи', () => {
    expect(noun('ev', {}, { plural: true })).toBe('evler');
    expect(noun('kitap', {}, { plural: true })).toBe('kitaplar');
    expect(noun('ev', {}, { case: 'loc' })).toBe('evde');
    expect(noun('kitap', {}, { case: 'loc' })).toBe('kitapta');
    expect(noun('okul', {}, { case: 'abl' })).toBe('okuldan');
    expect(noun('araba', {}, { case: 'acc' })).toBe('arabayı');
    expect(noun('kitap', {}, { case: 'acc' })).toBe('kitabı');
    expect(noun('ekmek', {}, { case: 'dat' })).toBe('ekmeğe');
    expect(noun('top', {}, { case: 'acc' })).toBe('topu');
    expect(noun('araba', {}, { case: 'gen' })).toBe('arabanın');
    expect(noun('ev', {}, { case: 'gen' })).toBe('evin');
    expect(noun('araba', {}, { case: 'ins' })).toBe('arabayla');
  });

  it('принадлежность и падеж после неё', () => {
    expect(noun('ev', {}, { poss: 1 })).toBe('evim');
    expect(noun('araba', {}, { poss: 3 })).toBe('arabası');
    expect(noun('ev', {}, { poss: 3, case: 'loc' })).toBe('evinde');
    expect(noun('kitap', {}, { poss: 4 })).toBe('kitabımız');
    expect(noun('ev', {}, { plural: true, poss: 1, case: 'abl' })).toBe('evlerimden');
    expect(noun('ev', {}, { poss: 6 })).toBe('evleri');
  });

  it('выпадение гласной, удвоение и обратная гармония из словаря', () => {
    expect(noun('ağız', { drop: true }, { poss: 3 })).toBe('ağzı');
    expect(noun('hak', { double: true }, { case: 'acc' })).toBe('hakkı');
    expect(noun('saat', { inverse: true, soft: false }, { case: 'acc' })).toBe('saati');
    expect(noun('saat', { inverse: true, soft: false }, { case: 'loc' })).toBe('saatte');
  });
});

describe('глагол', () => {
  it('настоящее на -iyor: гармония, выпадение a/e, озвончение', () => {
    expect(conjugate(v('gelmek'), 'iyor')).toEqual(['geliyorum', 'geliyorsun', 'geliyor', 'geliyoruz', 'geliyorsunuz', 'geliyorlar']);
    expect(conjugate(v('okumak'), 'iyor')[2]).toBe('okuyor');
    expect(conjugate(v('başlamak'), 'iyor')[2]).toBe('başlıyor');
    expect(conjugate(v('beklemek'), 'iyor')[2]).toBe('bekliyor');
    expect(conjugate(v('söylemek'), 'iyor')[2]).toBe('söylüyor');
    expect(conjugate(v('demek'), 'iyor')[0]).toBe('diyorum');
    expect(conjugate(v('gitmek', { soft: true }), 'iyor')[0]).toBe('gidiyorum');
    expect(conjugate(v('gelmek'), 'iyor', true)[0]).toBe('gelmiyorum');
  });

  it('прошедшее на -di: d/t, лица, отрицание', () => {
    expect(conjugate(v('gelmek'), 'di')).toEqual(['geldim', 'geldin', 'geldi', 'geldik', 'geldiniz', 'geldiler']);
    expect(conjugate(v('gitmek', { soft: true }), 'di')[0]).toBe('gittim');
    expect(conjugate(v('okumak'), 'di')[4]).toBe('okudunuz');
    expect(conjugate(v('okumak'), 'di', true)[0]).toBe('okumadım');
  });

  it('будущее на -ecek: k → ğ перед гласной лица, буфер y, de и ye', () => {
    expect(conjugate(v('gelmek'), 'ecek')).toEqual(['geleceğim', 'geleceksin', 'gelecek', 'geleceğiz', 'geleceksiniz', 'gelecekler']);
    expect(conjugate(v('okumak'), 'ecek')[0]).toBe('okuyacağım');
    expect(conjugate(v('gitmek', { soft: true }), 'ecek')[2]).toBe('gidecek');
    expect(conjugate(v('yemek'), 'ecek')[2]).toBe('yiyecek');
    expect(conjugate(v('gelmek'), 'ecek', true)[2]).toBe('gelmeyecek');
  });

  it('широкое время: 13 односложных на -ir, остальные односложные на -er, многосложные на -ir', () => {
    expect(conjugate(v('gelmek'), 'ir')[2]).toBe('gelir');
    expect(conjugate(v('almak'), 'ir')[2]).toBe('alır');
    expect(conjugate(v('gitmek', { soft: true }), 'ir')[2]).toBe('gider');
    expect(conjugate(v('yapmak'), 'ir')[2]).toBe('yapar');
    expect(conjugate(v('çalışmak'), 'ir')[2]).toBe('çalışır');
    expect(conjugate(v('okumak'), 'ir')[0]).toBe('okurum');
    expect(conjugate(v('gelmek'), 'ir', true)).toEqual(['gelmem', 'gelmezsin', 'gelmez', 'gelmeyiz', 'gelmezsiniz', 'gelmezler']);
  });

  it('пересказ на -miş', () => {
    expect(conjugate(v('gelmek'), 'mis')).toEqual(['gelmişim', 'gelmişsin', 'gelmiş', 'gelmişiz', 'gelmişsiniz', 'gelmişler']);
    expect(conjugate(v('okumak'), 'mis')[2]).toBe('okumuş');
    expect(conjugate(v('gelmek'), 'mis', true)[2]).toBe('gelmemiş');
  });

  it('кузница профиля строит шесть форм всех времён', () => {
    const verb = { inf: 'gitmek', ru: 'идти', soft: true };
    for (const t of TR.verbs.tenses) expect(TR.verbs.conjugate(verb, t.id)).toHaveLength(6);
    expect(TR.verbs.conjugate(verb, 'iyor')[0]).toBe('gidiyorum');
  });
});

describe('разбор словоформы на леммы', () => {
  const dict = new Set(['ev', 'kitap', 'gelmek', 'başlamak', 'ağız', 'okul', 'demek', 'gitmek']);
  const known = (l: string) => dict.has(l);

  it('находит лемму существительного и глагола под аффиксами', () => {
    expect(analyze('evlerimizden', known)).toContain('ev');
    expect(analyze('kitabı', known)).toContain('kitap');
    expect(analyze('ağzı', known)).toContain('ağız');
    expect(analyze('geliyorum', known)).toContain('gelmek');
    expect(analyze('gelmeyeceğiz', known)).toContain('gelmek');
    expect(analyze('başlıyor', known)).toContain('başlamak');
    expect(analyze('diyorum', known)).toContain('demek');
    expect(analyze('gidiyoruz', known)).toContain('gitmek');
    expect(analyze('okulda', known)).toContain('okul');
  });

  it('незнакомая основа не находится', () => {
    expect(analyze('masada', known)).toEqual([]);
  });
});

describe('ответ по-турецки', () => {
  it('строчные по-турецки: I → ı, İ → i', () => {
    expect(lowerText('IRMAK', 'tr')).toBe('ırmak');
    expect(lowerText('İzmir', 'tr')).toBe('izmir');
    expect(normalizeIn('İstanbul’a gidiyorum.', 'tr')).toBe("istanbul'a gidiyorum");
    // У других языков İ тоже без точки сверху, I — обычная i.
    expect(lowerText('İ', 'es')).toBe('i');
    expect(lowerText('I', 'en')).toBe('i');
  });

  it('без ç ş ğ ö ü — «почти», а ı вместо i и наоборот — ошибка', () => {
    expect(stripAccents('çiğ öğrenci şüphe')).toBe('cig ogrenci suphe');
    expect(checkTyped('gunes', ['güneş']).verdict).toBe('almost');
    expect(checkTyped('kir', ['kır']).verdict).toBe('wrong');
    expect(checkTyped('kır', ['kir']).verdict).toBe('wrong');
    expect(checkTyped('kır', ['kır']).verdict).toBe('correct');
  });

  it('«ты» и «вы» в оригинале: sen и siz', () => {
    expect(TR.you.ty.test('Sen nerelisin? Seni bekliyorum.')).toBe(true);
    expect(TR.you.ty.test('Ne yapıyorsun?')).toBe(true);
    expect(TR.you.formal.test('Siz nerelisiniz?')).toBe(true);
    expect(TR.you.formal.test('Ne yapıyorsunuz?')).toBe(true);
    expect(TR.you.ty.test('Kadın geldi.')).toBe(false);
    expect(TR.you.formal.test('Ne yapıyorsun?')).toBe(false);
  });
});

describe('валидатор турецкой кузницы', () => {
  it('soft — только у основы на p, ç, t, k; aorist по правилу не записывается', async () => {
    const { validateVerbs } = await import('../../content/validate');
    const smith = { name: 'Кузнец', role: 'кузнец', gender: 'm' as const, greeting: { es: 'Merhaba!', ru: 'Привет!' }, voice: { pitch: 0.9, rate: 0.9 }, look: { skin: 1, hair: '#333', style: 'short', outfit: '#555', pants: '#222' } };
    const msgs = (verbs: object[]) => validateVerbs({ smith, verbs } as never, 'tr').filter((i) => i.where.startsWith('verbs.json ') && i.where !== 'verbs.json кузнец').map((i) => i.msg);
    expect(msgs([{ inf: 'gitmek', ru: 'идти', soft: true }])).toEqual([]);
    expect(msgs([{ inf: 'gelmek', ru: 'приходить', soft: true }])).toContain('soft: основа не кончается на p, ç, t, k');
    expect(msgs([{ inf: 'gitmek', ru: 'идти', soft: true, aorist: 'A' }])).toContain('aorist A — гласная по правилу, запись не нужна');
    // san — из 13 односложных на -ır: записанная I лишняя, A — нет (это отличие от правила).
    expect(msgs([{ inf: 'sanmak', ru: 'думать', aorist: 'I' }])).toContain('aorist I — гласная по правилу, запись не нужна');
    expect(msgs([{ inf: 'sanmak', ru: 'думать', aorist: 'A' }])).toEqual([]);
  });
});

describe('турецкая Звонница', () => {
  it('ı/i и o/ö — замена буквы, циркумфлекс — знак над той же гласной, двойная — одна согласная', async () => {
    const { pairIssue } = await import('../../domain/minimalPairs');
    const w = (es: string, ru: string) => ({ es, ru });
    const swap = (a: string, b: string) => ({ id: 'x', title: 't', hint: 'h', kind: 'swap' as const, swap: [a, b] as [string, string], pairs: [] });
    expect(pairIssue(swap('ı', 'i'), [w('kır', 'поле'), w('kir', 'грязь')])).toBeNull();
    expect(pairIssue(swap('o', 'ö'), [w('kok', 'пахни'), w('kök', 'корень')])).toBeNull();
    const stress = { id: 'x', title: 't', hint: 'h', kind: 'stress' as const, pairs: [] };
    expect(pairIssue(stress, [w('hala', 'тётя'), w('hâlâ', 'всё ещё')])).toBeNull();
    expect(pairIssue(stress, [w('kar', 'снег'), w('kır', 'поле')])).toBe('слова различаются не только ударением');
    const double = { id: 'x', title: 't', hint: 'h', kind: 'double' as const, pairs: [] };
    expect(pairIssue(double, [w('elli', 'пятьдесят'), w('eli', 'его рука')])).toBeNull();
  });
});

describe('слова глав I–V турецкого (задачи 18.3, 18.6–18.8)', () => {
  const dir = (name: string) => join(import.meta.dirname, '..', '..', 'content', 'tr', name);
  const files = <T,>(name: string) =>
    readdirSync(dir(name)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ name: f, data: JSON.parse(readFileSync(join(dir(name), f), 'utf8')) as T }));
  const words = files<LocationWords>('words');
  const scrolls = files<ScrollFile>('scrolls');

  it('20 мест по 12 слов на каждом уровне 1–4, по 30 на уровнях 5–6 и 25 на уровне 7, свитки I–V по плану', () => {
    expect(words).toHaveLength(20);
    for (const { name, data } of words) {
      for (const level of [1, 2, 3, 4]) expect(data.words.filter((w) => w.level === level), `${name} уровень ${level}`).toHaveLength(12);
      for (const level of [5, 6]) expect(data.words.filter((w) => w.level === level), `${name} уровень ${level}`).toHaveLength(30);
      expect(data.words.filter((w) => w.level === 7 && !w.kind), `${name} уровень 7`).toHaveLength(25);
    }
    expect(scrolls.map((s) => [s.data.chapter, s.data.words.length])).toEqual([1, 2, 3, 4, 5].map((ch) => [ch, CHAPTERS[ch - 1].scroll]));
  });

  it('проходят проверку слов, свитков и одинаковых переводов без замечаний, рода нет', async () => {
    const { validateWords, validateScrolls, validateTranslations } = await import('../../content/validate');
    expect(validateWords(words, 'tr')).toEqual([]);
    expect(validateScrolls(scrolls, words, 'tr')).toEqual([]);
    expect(validateTranslations(words, scrolls)).toEqual([]);
    for (const { data } of [...words, ...scrolls]) for (const w of data.words) expect(w.gender, w.id).toBeUndefined();
  });

  it('слово в примере ищется разбором аффиксов: kitabı — kitap, gidiyorum — gitmek, yardım eder — yardım etmek', async () => {
    const { validateWords } = await import('../../content/validate');
    const w = (es: string, pos: string, example: string) => ({ id: `cafe.${es.replace(/\s/g, '-')}`, es, ru: es, pos, level: 1, cefr: 'A1', example: { es: example, ru: 'пример' } });
    const warn = (...ws: ReturnType<typeof w>[]) =>
      validateWords([{ name: 'cafe.json', data: { location: 'cafe', words: ws } as unknown as LocationWords }], 'tr')
        .map((i) => i.msg)
        .filter((m) => m.startsWith('в примере'));
    expect(warn(w('kitap', 'noun', 'Kitabı aç.'), w('gitmek', 'verb', 'Eve gidiyorum.'), w('yardım etmek', 'verb', 'Bana yardım eder misin?'))).toEqual([]);
    expect(warn(w('kitap', 'noun', 'Defter burada.'))).toEqual(['в примере нет слова "kitap"']);
  });
});

describe('грамматика A1–A2 турецкого (задача 18.4)', () => {
  const root = join(import.meta.dirname, '..', '..', 'content', 'tr', 'grammar');
  const ids = readdirSync(root).flatMap((d) => readdirSync(join(root, d)).map((f) => `${d}.${f.replace(/\.json$/, '')}`));

  it('по 31 уроку в районах A1 и A2', () => {
    expect(ids.filter((i) => i.startsWith('a1.'))).toHaveLength(31);
    expect(ids.filter((i) => i.startsWith('a2.'))).toHaveLength(31);
  });

  it('уроки, открывающие времена кузницы A1–A2, есть в контенте (-miş — урок B1, задача 18.6)', () => {
    const tenses = TR.verbs.tenses.filter((t) => /^a[12]\./.test(t.lesson));
    expect(tenses.map((t) => t.id)).toEqual(['iyor', 'di', 'ecek', 'ir']);
    for (const t of tenses) expect(ids, t.id).toContain(t.lesson);
  });
});
