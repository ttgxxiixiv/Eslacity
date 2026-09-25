import { describe, expect, it } from 'vitest';
import { checkTyped, levenshtein, normalize, splitArticle, stripAccents } from './answer';

describe('normalize', () => {
  it('убирает регистр, ¿¡ и пунктуацию, схлопывает пробелы', () => {
    expect(normalize('  ¿Qué   le pongo? ')).toBe('qué le pongo');
    expect(normalize('¡Hola!')).toBe('hola');
    expect(normalize('El Café')).toBe('el café');
  });
  it('убирает тире из диалогов', () => {
    expect(normalize('—No, gracias.')).toBe('no gracias');
  });
  it('сохраняет ударения', () => {
    expect(normalize('está')).toBe('está');
  });
});

describe('levenshtein', () => {
  it('считает расстояние', () => {
    expect(levenshtein('cafe', 'cafe')).toBe(0);
    expect(levenshtein('cafe', 'cafee')).toBe(1);
    expect(levenshtein('taza', 'tasa')).toBe(1);
    expect(levenshtein('leche', 'lceeh')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('stripAccents / splitArticle', () => {
  it('снимает диакритику', () => {
    expect(stripAccents('está azúcar año pingüino')).toBe('esta azucar ano pinguino');
  });
  it('отделяет артикль', () => {
    expect(splitArticle('El café con leche')).toEqual({ article: 'el', core: 'café con leche' });
    expect(splitArticle('gracias')).toEqual({ article: null, core: 'gracias' });
  });
});

describe('checkTyped', () => {
  const ok = (input: string, ...acc: string[]) => checkTyped(input, acc).verdict;

  it('точный ответ без учёта регистра и ¿¡', () => {
    expect(ok('el café', 'el café')).toBe('correct');
    expect(ok('EL CAFÉ', 'el café')).toBe('correct');
    expect(ok('que le pongo', '¿Qué le pongo?')).not.toBe('wrong');
    expect(ok('¿qué le pongo?', '¿Qué le pongo?')).toBe('correct');
    expect(ok('qué le pongo', '¿Qué le pongo?')).toBe('correct');
  });

  it('без ударения → почти, с правильным написанием', () => {
    const r = checkTyped('esta', ['está']);
    expect(r).toEqual({ verdict: 'almost', expected: 'está', reason: 'accent' });
    expect(ok('el cafe', 'el café')).toBe('almost');
    expect(ok('el azucar', 'el azúcar')).toBe('almost');
    expect(ok('ano', 'año')).toBe('almost');
  });

  it('одна опечатка → почти', () => {
    expect(checkTyped('la tasa', ['la taza'])).toMatchObject({ verdict: 'almost', reason: 'typo' });
    expect(ok('gracas', 'gracias')).toBe('almost');
    expect(ok('graciass', 'gracias')).toBe('almost');
  });

  it('две ошибки → неверно', () => {
    expect(ok('grasas', 'gracias')).toBe('wrong');
    // ударение + опечатка тоже две ошибки
    expect(ok('el cafee', 'el café')).toBe('wrong');
  });

  it('короткие слова не прощают опечатку', () => {
    expect(ok('ya', 'yo')).toBe('wrong');
    expect(ok('te', 'té')).toBe('almost'); // это ударение, не опечатка
  });

  it('артикль обязателен и должен быть правильным', () => {
    expect(checkTyped('café', ['el café'])).toMatchObject({ verdict: 'wrong', reason: 'article' });
    expect(checkTyped('la café', ['el café'])).toMatchObject({ verdict: 'wrong', reason: 'article' });
    expect(ok('el agua', 'el agua')).toBe('correct');
  });

  it('принимает альтернативы', () => {
    expect(ok('el café solo', 'el café', 'el café solo')).toBe('correct');
    expect(checkTyped('el cafe solo', ['el café', 'el café solo'])).toMatchObject({
      verdict: 'almost', expected: 'el café solo',
    });
  });

  it('пустой ввод неверен', () => {
    expect(ok('   ', 'el té')).toBe('wrong');
  });
});
