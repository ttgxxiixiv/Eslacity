import { describe, expect, it } from 'vitest';
import { buildLexicon, coverage, glossIndex, stemOf, textCoverage, lemmaOf, lemmasIn, parseFreq, parseLemmas, share, tokens, uncoveredWords } from './vocab-lib';

const freq = parseFreq(['# шапка', '1\tel\t100\t?', '2\tser\t90\t', '3\tjohn\t80\t?', '4\tcasa\t70\t', '5\tque\t60\t?', '6\tperro\t50\t'].join('\n'));
const forms = parseLemmas(['# шапка', 'es\tser', 'la\tel', 'casas\tcasa'].join('\n'));

describe('разбор данных', () => {
  it('частотный список и таблица форм', () => {
    expect(freq).toHaveLength(6);
    expect(freq[0]).toEqual({ rank: 1, lemma: 'el', count: 100, service: true });
    expect(forms.get('casas')).toBe('casa');
  });
});

describe('леммы', () => {
  it('слова строки без кириллицы, с апострофом элизии', () => {
    expect(tokens('¿Dónde está l’aeroporto? Где')).toEqual(['dónde', 'está', "l'", 'aeroporto']);
  });
  it('формы по таблице, возвратные глаголы к инфинитиву', () => {
    expect(lemmaOf('es', forms, 'es')).toBe('ser');
    expect(lemmaOf('abrocharse', forms, 'es')).toBe('abrochar');
    expect(lemmaOf('allenarsi', forms, 'it')).toBe('allenare');
    expect(lemmaOf('andarsene', forms, 'it')).toBe('andare');
    expect(lemmasIn('La casa es', forms, 'es')).toEqual(['el', 'casa', 'ser']);
  });
});

describe('покрытие', () => {
  const cov = coverage(freq, {
    words: new Set(['casa']),
    grammar: new Set(['ser']),
    anywhere: new Set(['casa', 'ser', 'el', 'que']),
  });
  it('служебные леммы, которых нет в курсе, выбрасываются как шум', () => {
    expect(cov.noise).toBe(1);
    expect(cov.ranked.map((e) => `${e.rank}${e.lemma}`)).toEqual(['1el', '2ser', '3casa', '4que', '5perro']);
  });
  it('слово засчитано словами, грамматикой или не засчитано', () => {
    expect(cov.covered('casa')).toBe('words');
    expect(cov.covered('ser')).toBe('grammar');
    expect(cov.covered('que')).toBe('grammar');
    expect(cov.covered('perro')).toBeNull();
  });
  it('доля покрытых среди первых n', () => {
    expect(share(cov, 3)).toEqual({ words: 1, total: 3, n: 3 });
    expect(share(cov, 100)).toEqual({ words: 1, total: 4, n: 5 });
  });
});

describe('словарь для фраз', () => {
  const lem = (t: string) => lemmasIn(t, forms, 'es');
  const lesson = {
    theory: [{ kind: 'table' as const, rows: [{ cells: ['es', 'la'] }] }],
    examples: [{ es: 'Que sí.' }],
    exercises: [],
  };
  const lex = buildLexicon(
    [{ es: 'la casa', level: 1, example: { es: 'Es la casa.' } }, { es: 'el perro', level: 3, example: { es: 'El perro.' } }],
    [lesson],
    freq,
    lem,
  );
  it('слово известно с уровня места, грамматика и служебные слова — всегда', () => {
    expect(lex.wordLevel.get('casa')).toBe(1);
    expect(uncoveredWords('Es la casa', 1, lex, forms, 'es')).toEqual([]);
    expect(uncoveredWords('que el perro', 2, lex, forms, 'es')).toEqual(['perro']);
    expect(uncoveredWords('que el perro', 3, lex, forms, 'es')).toEqual([]);
  });
  it('незнакомое слово и служебное, которого нет в курсе', () => {
    expect(uncoveredWords('La casas de John', 1, lex, forms, 'es')).toEqual(['de', 'john']);
  });
});

describe('формы без таблицы лемм', () => {
  it('основа: множественное, род, ударение, элизия', () => {
    expect(stemOf('melocotones')).toBe(stemOf('melocotón'));
    expect(stemOf('llena')).toBe(stemOf('lleno'));
    expect(stemOf('ciliegie')).toBe(stemOf('ciliegia'));
    expect(stemOf("quant'")).toBe(stemOf('quanto'));
    expect(stemOf('ecológicos')).toBe(stemOf('ecológico'));
    expect(stemOf('ricci')).toBe(stemOf('riccio'));
  });
  it('формы узнаются на своём уровне, спряжённый глагол — по основе', () => {
    const lex = buildLexicon(
      [
        { es: 'el melocotón', level: 3, example: { es: 'x' } },
        { es: 'cobrar', level: 4, example: { es: 'x' } },
        { es: 'lavar', level: 1, example: { es: 'x' } },
        { es: 'teñirse', level: 2, example: { es: 'x' } },
      ],
      [],
      [],
      (t) => lemmasIn(t, new Map(), 'es'),
    );
    const miss = (t: string, l: number) => uncoveredWords(t, l, lex, new Map(), 'es');
    expect(miss('melocotones', 3)).toEqual([]);
    expect(miss('melocotones', 2)).toEqual(['melocotones']);
    expect(miss('cobra cobramos', 4)).toEqual([]);
    expect(miss('cobra', 3)).toEqual(['cobra']);
    // Короткая основа — только с окончанием спряжения, не любое слово на «lav».
    expect(miss('lava lavamos', 1)).toEqual([]);
    expect(miss('lavabo', 1)).toEqual(['lavabo']);
    expect(miss('teñirme', 2)).toEqual([]);
  });
});

describe('сцены: покрытие и перевод слова', () => {
  const words = [
    { es: 'el melocotón', ru: 'персик', level: 3, example: { es: 'x' } },
    { es: 'cobrar', ru: 'брать плату', level: 4, example: { es: 'x' } },
    { es: 'la casa', ru: 'дом', level: 1, example: { es: 'x' } },
    { es: 'abrir una cuenta', ru: 'открыть счёт', level: 4, example: { es: 'x' } },
  ];
  const lex = buildLexicon(words, [], [], (t) => lemmasIn(t, new Map(), 'es'));
  it('доля незнакомых считается с повторами', () => {
    expect(textCoverage('la casa y la casa grande', 1, lex, new Map(), 'es')).toEqual({ total: 6, unknown: ['y', 'grande'] });
  });
  it('перевод по лемме, основе и спряжению', () => {
    const g = glossIndex(words, new Map(), 'es');
    expect(g('Casa')).toBe('дом');
    expect(g('melocotones')).toBe('персик');
    expect(g('cobramos')).toBe('брать плату');
    expect(g('bicicleta')).toBeUndefined();
    // Слова словосочетаний и артикли своих переводов не получают.
    expect(g('una')).toBeUndefined();
    expect(g('la')).toBeUndefined();
    const it = glossIndex([{ es: 'la pera', ru: 'груша', level: 3 }, { es: 'il tè', ru: 'чай', level: 1 }], new Map(), 'it');
    expect([it('per'), it('te'), it('pere')]).toEqual([undefined, undefined, 'груша']);
  });
});
