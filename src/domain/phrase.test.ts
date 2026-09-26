import { describe, expect, it } from 'vitest';
import { expandOptional, fullPhrase, optionalError, phraseWords } from './phrase';

describe('необязательные слова во фразе', () => {
  it('одна группа: с ней и без неё', () => {
    expect(expandOptional('(Yo) quiero un café.')).toEqual(['Yo quiero un café.', 'quiero un café.']);
    expect(fullPhrase('Un té (con leche), por favor.')).toBe('Un té con leche, por favor.');
    expect(expandOptional('Un té (con leche), por favor.')[1]).toBe('Un té, por favor.');
  });
  it('две группы — четыре варианта, без повторов', () => {
    expect(expandOptional('(Io) prendo (un) caffè')).toEqual(['Io prendo un caffè', 'Io prendo caffè', 'prendo un caffè', 'prendo caffè']);
    expect(expandOptional('Hola')).toEqual(['Hola']);
  });
  it('разметка скобок', () => {
    expect(optionalError('(Yo) quiero')).toBeNull();
    expect(optionalError('((Yo)) quiero')).toBe('вложенные скобки');
    expect(optionalError('(Yo quiero')).toBe('незакрытая скобка');
    expect(optionalError('Yo) quiero')).toBe('лишняя закрывающая скобка');
    expect(optionalError('Yo ( ) quiero')).toBe('пустые скобки');
    expect(optionalError('(Yo quiero).')).toBe('вся фраза в скобках');
  });
  it('длина по самому длинному варианту, знаки не считаются', () => {
    expect(phraseWords('¿(Me) trae la cuenta, por favor?')).toBe(6);
    expect(phraseWords('Un café — ¡rápido!')).toBe(3);
  });
});
