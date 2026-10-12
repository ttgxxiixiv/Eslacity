import { describe, expect, it } from 'vitest';
import { EN } from '.';
import { canon, checkForm, checkPhrase, normalize } from '../../domain/answer';
import { checkWord, type Issue } from '../../content/validate';
import type { Word } from '../../content/schema';
import type { VerbData } from '../types';

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

  it('валидатор: рода нет, артикль a/an проверяется у слова и примера', () => {
    const w = { id: 'cafe.apple', es: 'apple', ru: 'яблоко', pos: 'noun', level: 1, cefr: 'A1', example: { es: 'I want a apple.', ru: 'Я хочу яблоко.' } } as Word;
    const out: Issue[] = [];
    checkWord(w, 'x', 'en', out);
    expect(out.map((i) => i.msg)).toEqual(['«a apple»: перед «apple» нужен артикль «an»']);
    const ok: Issue[] = [];
    checkWord({ ...w, example: { es: 'I want an apple.', ru: 'Я хочу яблоко.' } }, 'x', 'en', ok);
    expect(ok).toEqual([]);
  });
});
