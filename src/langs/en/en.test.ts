import { describe, expect, it } from 'vitest';
import { EN } from '.';
import { canon, checkForm, checkPhrase, normalize } from '../../domain/answer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkWord, validateChronicler, validateGuardians, validateNpcs, validatePairs, validateScrolls, validateTranslations, validateVerbs, validateWords, type Issue } from '../../content/validate';
import type { Chronicler, GuardiansFile, LocationWords, NpcsFile, PairsFile, ScrollFile, VerbsFile } from '../../content/schema';
import { readdirSync } from 'node:fs';
import { forgeTasks } from '../../domain/verbs';
import { seeded } from '../../domain/generators';
import { addressHero } from '../../domain/address';
import { textIssuesIn } from '../../domain/translation';
import type { Word } from '../../content/schema';
import type { VerbData } from '../types';
import { CHAPTERS, PLACE_LEVEL_MAX } from '../../content/vocabPlan';

const forms = (v: Partial<VerbData> & { inf: string }, t: Parameters<typeof EN.verbs.conjugate>[1]) => EN.verbs.conjugate({ ru: '', ...v }, t);

describe('английский профиль (задача 17.1)', () => {
  it('Present Simple: -s, -es, -ies', () => {
    expect(forms({ inf: 'work' }, 'present-simple')).toEqual(['work', 'work', 'works', 'work', 'work', 'work']);
    expect(forms({ inf: 'watch' }, 'present-simple')[2]).toBe('watches');
    expect(forms({ inf: 'go' }, 'present-simple')[2]).toBe('goes');
    expect(forms({ inf: 'study' }, 'present-simple')[2]).toBe('studies');
    expect(forms({ inf: 'play' }, 'present-simple')[2]).toBe('plays');
  });

  it('-ing и -ed по правилам написания, удвоение согласной', () => {
    expect(forms({ inf: 'make' }, 'present-continuous')[0]).toBe('am making');
    expect(forms({ inf: 'lie' }, 'present-continuous')[2]).toBe('is lying');
    expect(forms({ inf: 'see' }, 'present-continuous')[1]).toBe('are seeing');
    expect(forms({ inf: 'stop' }, 'present-continuous')[0]).toBe('am stopping');
    expect(forms({ inf: 'stop' }, 'past-simple')[0]).toBe('stopped');
    expect(forms({ inf: 'live' }, 'past-simple')[0]).toBe('lived');
    expect(forms({ inf: 'study' }, 'past-simple')[0]).toBe('studied');
    expect(forms({ inf: 'play' }, 'past-simple')[0]).toBe('played');
    expect(forms({ inf: 'visit' }, 'past-simple')[0]).toBe('visited');
    expect(forms({ inf: 'fix' }, 'past-simple')[0]).toBe('fixed');
    expect(forms({ inf: 'prefer', dbl: true }, 'past-simple')[0]).toBe('preferred');
  });

  it('неправильные глаголы: прошедшее и причастие из записи', () => {
    expect(forms({ inf: 'go', past: 'went', pp: 'gone' }, 'past-simple')[3]).toBe('went');
    expect(forms({ inf: 'go', past: 'went', pp: 'gone' }, 'present-perfect')).toEqual(['have gone', 'have gone', 'has gone', 'have gone', 'have gone', 'have gone']);
    // Причастие без своей записи — как прошедшее: buy → bought.
    expect(forms({ inf: 'buy', past: 'bought' }, 'present-perfect')[2]).toBe('has bought');
    expect(forms({ inf: 'work' }, 'present-perfect')[0]).toBe('have worked');
    const be = { inf: 'be', forms: { 'present-simple': ['am', 'are', 'is', 'are', 'are', 'are'] } };
    expect(forms(be, 'present-simple')[2]).toBe('is');
  });

  it('a и an по первому звуку', () => {
    const t = EN.textIssues!;
    expect(t('I eat an apple.')).toEqual([]);
    expect(t('I eat a apple.')).toEqual(['«a apple»: перед «apple» нужен артикль «an»']);
    expect(t('an book')).toHaveLength(1);
    expect(t('a university, a useful tool, a European city, a one-way ticket')).toEqual([]);
    expect(t('an hour, an honest man, an umbrella, an unimportant detail')).toEqual([]);
    expect(t('a hour')).toHaveLength(1);
    expect(t('an university')).toHaveLength(1);
    expect(t('an MP, A cat')).toEqual([]);
    // Буква в начале слова читается своим названием.
    expect(t('an X-ray, a U-turn, an F')).toEqual([]);
    expect(t('a X-ray')).toHaveLength(1);
  });

  it('сокращения и полные формы — один ответ', () => {
    expect(normalize("I don't know")).toBe(normalize('I do not know'));
    expect(normalize("She's here, it’s fine")).toBe('she is here it is fine');
    expect(normalize('I can not swim')).toBe(normalize("I can't swim"));
    expect(checkForm('do not', ["don't"]).verdict).toBe('correct');
    expect(checkPhrase("I'm from Spain", { es: 'I am from Spain.' }).verdict).toBe('correct');
    // Итальянская склейка и испанский текст не задеты.
    expect(normalize("l' acqua")).toBe("l'acqua");
    expect(normalize('¿Dónde está?')).toBe('dónde está');
  });

  it('американское написание засчитывается только в английском', () => {
    expect(canon('My favorite color', 'en')).toBe(canon('my favourite colour', 'en'));
    expect(canon('the center of town', 'en')).toBe('the centre of town');
    expect(canon('el color', 'es')).toBe('el color');
  });

  it('валидатор: рода нет, артикль a/an проверяется во всех текстах файла', () => {
    const w = { id: 'cafe.apple', es: 'apple', ru: 'яблоко', pos: 'noun', level: 1, cefr: 'A1', example: { es: 'I want a apple.', ru: 'Я хочу яблоко.' } } as Word;
    const out: Issue[] = [];
    checkWord(w, 'x', 'en', out);
    expect(out).toEqual([]);
    expect(textIssuesIn({ words: [w] }, 'en')).toEqual([{ where: 'words[0].example', msg: '«a apple»: перед «apple» нужен артикль «an»' }]);
    expect(textIssuesIn({ lines: [{ es: 'An dog barks.', fem: { es: 'A elephant.' } }] }, 'en')).toHaveLength(2);
    expect(textIssuesIn({ words: [w] }, 'es')).toEqual([]);
  });
});

describe('английский город (задача 17.2)', () => {
  const read = <T,>(name: string) => JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'content', 'en', name), 'utf8')) as T;

  it('жители, Летописец, стражи пяти глав, кузница и Звонница проходят проверку', () => {
    const npcs = read<NpcsFile>('npcs.json');
    expect(validateNpcs(npcs)).toEqual([]);
    expect(validateChronicler(read<Chronicler>('chronicler.json'), npcs)).toEqual([]);
    expect(validateGuardians(read<GuardiansFile>('guardians.json'), [1, 2, 3, 4, 5])).toEqual([]);
    expect(validateVerbs(read<VerbsFile>('verbs.json'), 'en')).toEqual([]);
    expect(validatePairs(read<PairsFile>('pairs.json'), 'en')).toEqual([]);
  });

  it('записи глаголов: правильное прошедшее и лишнее причастие не записываются, поля чужого языка — ошибка', () => {
    const f = read<VerbsFile>('verbs.json');
    f.verbs.push({ inf: 'jump', ru: 'прыгать', past: 'jumped' }, { inf: 'hit', ru: 'ударять', past: 'hit', pp: 'hit' });
    expect(validateVerbs(f, 'en').map((i) => i.msg)).toEqual([
      'прошедшее past совпадает с правильным, запись не нужна',
      'причастие pp совпадает с past, запись не нужна',
    ]);
    const es = { smith: f.smith, verbs: [{ inf: 'hablar', ru: 'говорить', stative: true }] } as VerbsFile;
    expect(validateVerbs(es, 'es').map((i) => i.msg)).toContain('поле stative не бывает у глаголов испанского');
  });

  it('кузница не даёт глаголы состояния в Continuous', () => {
    const verbs: VerbData[] = [{ inf: 'know', ru: 'знать', past: 'knew', pp: 'known', stative: true }, { inf: 'work', ru: 'работать' }];
    const tasks = forgeTasks(verbs, 'en', ['present-simple', 'present-continuous'], ['v:know.present-continuous.1'], 12, seeded(5));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.inf === 'know' && t.tense === 'present-continuous')).toBe(false);
    expect(tasks.find((t) => t.inf === 'know')?.forms.some((x) => x.form.includes('knowing'))).toBe(false);
    expect(tasks.some((t) => t.inf === 'work' && t.tense === 'present-continuous')).toBe(true);
  });

  it('обращение к путнику: имя вместо «traveller»', () => {
    expect(addressHero('Hello, traveller. Do you speak English?', 'en', { name: 'Ann', gender: 'f' })).toBe('Hello, Ann. Do you speak English?');
    expect(addressHero('Hello, traveller.', 'en', { name: '', gender: 'f' })).toBe('Hello, traveller.');
  });
});

describe('слова глав I–III английского (задачи 17.3, 17.6)', () => {
  const dir = (name: string) => join(import.meta.dirname, '..', '..', 'content', 'en', name);
  const files = <T,>(name: string) =>
    readdirSync(dir(name)).filter((f) => f.endsWith('.json')).sort().map((f) => ({ name: f, data: JSON.parse(readFileSync(join(dir(name), f), 'utf8')) as T }));
  const words = files<LocationWords>('words');
  const scrolls = files<ScrollFile>('scrolls');

  it('20 мест по 10–12 слов на каждом уровне 1–4, по 30 на уровнях 5 и 6, 25 слов (без выражений) на уровне 7, свитки I–V по плану', () => {
    expect(words).toHaveLength(20);
    for (const { name, data } of words) {
      for (const level of [1, 2, 3, 4]) {
        const n = data.words.filter((w) => w.level === level).length;
        expect(n >= 10 && n <= 12, `${name} уровень ${level}: ${n}`).toBe(true);
      }
      for (const level of [5, 6, 7]) expect(data.words.filter((w) => w.level === level && !w.kind), `${name} уровень ${level}`).toHaveLength(PLACE_LEVEL_MAX[level]);
    }
    expect(scrolls.map((s) => [s.data.chapter, s.data.words.length])).toEqual(CHAPTERS.map((c, i) => [i + 1, c.scroll]));
  });

  it('проходят проверку слов, свитков и одинаковых переводов без замечаний', () => {
    expect(validateWords(words, 'en')).toEqual([]);
    expect(validateScrolls(scrolls, words, 'en')).toEqual([]);
    expect(validateTranslations(words, scrolls)).toEqual([]);
    for (const f of [...words, ...scrolls]) expect(textIssuesIn(f.data, 'en'), f.name).toEqual([]);
  });

  it('у существительных нет рода и артикля: английский профиль без рода', () => {
    for (const { data } of [...words, ...scrolls]) for (const w of data.words) expect(w.gender, w.id).toBeUndefined();
  });
});

describe('грамматика A1–A2 английского (задача 17.4)', () => {
  const root = join(import.meta.dirname, '..', '..', 'content', 'en', 'grammar');
  const ids = readdirSync(root).flatMap((d) => readdirSync(join(root, d)).map((f) => `${d}.${f.replace(/\.json$/, '')}`));

  it('по 31 уроку в районах A1 и A2', () => {
    expect(ids.filter((i) => i.startsWith('a1.'))).toHaveLength(31);
    expect(ids.filter((i) => i.startsWith('a2.'))).toHaveLength(31);
  });

  it('уроки, открывающие времена кузницы, есть в контенте', () => {
    for (const t of EN.verbs.tenses) expect(ids, t.id).toContain(t.lesson);
  });
});
