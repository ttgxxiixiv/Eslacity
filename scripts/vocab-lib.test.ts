import { describe, expect, it } from 'vitest';
import { applySkips, applySkipsToForms, cefrIssues, cefrOfRank, loweredCefr, parseRisky, rarityIssues, riskyIssues, buildLexicon, coverage, parseSkips, glossIndex, lemmaRanks, median, stemOf, wordRank, textCoverage, lemmaOf, lemmasIn, parseFreq, parseLemmas, share, tokens, uncoveredWords } from './vocab-lib';

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

describe('ранги слов (задача 12.1)', () => {
  const cov = coverage(freq, { words: new Set(['casa']), grammar: new Set(['ser']), anywhere: new Set(['el', 'que']) });
  const ranks = lemmaRanks(cov);
  it('ранг по очищенному списку: шум не считается', () => {
    expect(ranks.get('casa')).toBe(3);
    expect(ranks.has('john')).toBe(false);
  });
  it('ранг слова — по единственной лемме, артикль не в счёт', () => {
    expect(wordRank('la casa', forms, 'es', ranks)).toBe(3);
    expect(wordRank('las casas', forms, 'es', ranks)).toBe(3);
    expect(wordRank('el gato', forms, 'es', ranks)).toBe(Infinity);
    expect(wordRank('la casa grande', forms, 'es', ranks)).toBeUndefined();
  });
  it('медиана: вне списка — в конце', () => {
    expect(median([5, 1, Infinity])).toBe(5);
    expect(median([4, 1, 2, 3])).toBe(2);
    expect(median([])).toBeUndefined();
  });
});

describe('поправки к частотному списку', () => {
  const skips = parseSkips(['# шапка', 'john', 'casas > casa', ''].join('\n'));
  it('разбор: выброс и форма другой леммы', () => {
    expect([...skips.drop]).toEqual(['john']);
    expect(skips.alias.get('casas')).toBe('casa');
  });
  it('таблица форм ведёт к поправленной лемме', () => {
    const f = applySkipsToForms(new Map([['abajo', 'abajar'], ['scorso', 'scorrere'], ['casas', 'casa']]), parseSkips('abajar > abajo\nscorso > scorso'));
    expect(f.get('abajo')).toBe('abajo');
    expect(f.get('abajar')).toBe('abajo');
    expect(f.get('scorso')).toBe('scorso');
    expect(f.get('casas')).toBe('casa');
  });
  it('выброшенные пропадают, формы складываются с леммой, ранги заново', () => {
    const f = applySkips(parseFreq(['1\tser\t90\t', '2\tjohn\t80\t?', '3\tcasas\t60\t', '4\tcasa\t50\t', '5\tperro\t70\t'].join('\n')), skips);
    expect(f.map((e) => [e.rank, e.lemma, e.count])).toEqual([[1, 'casa', 110], [2, 'ser', 90], [3, 'perro', 70]]);
  });
});

describe('редкие слова на ранних уровнях', () => {
  const rank = (es: string) => ({ casa: 10, gato: 9000, por_favor: undefined } as Record<string, number | undefined>)[es];
  const halves = <T>(ws: T[]) => [ws.slice(0, 2), ws.slice(2)];
  it('редкое без пометки, пометка не к месту', () => {
    const out = rarityIssues(
      [
        { level: 2, words: [{ id: 'a', es: 'gato' }, { id: 'b', es: 'casa', topical: true }, { id: 'c', es: 'gato', topical: true }] },
        { level: 5, words: [{ id: 'd', es: 'gato', topical: true }, { id: 'e', es: 'gato' }] },
      ],
      rank,
      halves,
    );
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'd']);
  });
  it('тематических не больше трёх на урок', () => {
    const ws = [1, 2, 3, 4, 5].map((i) => ({ id: `w${i}`, es: 'gato', topical: true }));
    expect(rarityIssues([{ level: 3, words: ws }], rank, (w) => [w.slice(0, 4), w.slice(4)])).toEqual([
      { id: 'w1', msg: 'урок 1 уровня 3: тематических слов 4, не больше 3' },
    ]);
  });
});

describe('CEFR по частотности и рискованные слова (задача 15.2)', () => {
  const rank: Record<string, number | undefined> = { 'el balón': 3245, 'la casa': 120, 'la rareza': Infinity, 'por favor': undefined };
  const at = (es: string) => rank[es];
  const word = (id: string, es: string, cefr: string, extra: object = {}) => ({ id, es, cefr, ...extra });

  it('полосы рангов', () => {
    expect([1, 800, 801, 1600, 3200, 6000, 6001].map(cefrOfRank)).toEqual(['A1', 'A1', 'A2', 'A2', 'B1', 'B2', 'C1']);
    expect(loweredCefr('A1')).toBe('A2');
  });
  it('завышенный больше чем на ступень — предупреждение, заниженный и на ступень — нет', () => {
    const issues = cefrIssues(
      [
        word('a', 'la casa', 'B1'),
        word('b', 'la casa', 'A2'),
        word('c', 'el balón', 'A1'),
        word('d', 'el balón', 'C1', { kind: 'false-friend' }),
        word('e', 'el balón', 'C1', { kind: 'idiom' }),
        word('f', 'la rareza', 'A1'),
        word('g', 'por favor', 'C1'),
        word('h', 'la casa', 'C1', { topical: true }),
      ],
      at,
    );
    expect(issues.map((i) => [i.id, i.want])).toEqual([['a', 'A1']]);
  });
  it('рискованная лемма требует пометки и пояснения', () => {
    const risky = parseRisky('# комментарий\ncoger | грубое в Латинской Америке\n');
    expect(risky.get('coger')).toBe('грубое в Латинской Америке');
    const lemmas = (t: string) => t.split(' ');
    const issues = riskyIssues(
      [
        word('a', 'coger un avión', 'A2'),
        word('b', 'coger el tren', 'A2', { usage: 'regional', usageNote: 'в Латинской Америке грубое' }),
        word('c', 'coger fondo', 'A2', { usage: 'regional' }),
        word('d', 'tomar un avión', 'A2'),
      ],
      risky,
      lemmas,
    );
    expect(issues.map((i) => i.id)).toEqual(['a', 'c']);
  });
});
