import { describe, expect, it } from 'vitest';
import { diagnose, checkTyped, levenshtein, normalize, answerLetters, splitArticle, stripAccents, checkPhrase, checkBuilt, checkForm } from './answer';

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

describe('answerLetters', () => {
  it('все буквы ответа по одному разу, по алфавиту', () => {
    expect(answerLetters('el plátano')).toEqual({ letters: ['a', 'á', 'e', 'l', 'n', 'o', 'p', 't'], space: true });
    expect(answerLetters('el té').letters).toEqual(['e', 'é', 'l', 't']);
  });
  it('без знаков препинания и пробела, если слово одно', () => {
    expect(answerLetters('¿Qué?')).toEqual({ letters: ['é', 'q', 'u'], space: false });
    expect(answerLetters('señor').letters).toContain('ñ');
  });
});

describe('итальянский', () => {
  it('артикли il/lo/la/l\', i/gli/le и слитные l\'/un\'', () => {
    expect(splitArticle("l'acqua", 'it')).toEqual({ article: "l'", core: 'acqua' });
    expect(splitArticle('lo zucchero', 'it')).toEqual({ article: 'lo', core: 'zucchero' });
    expect(splitArticle('gli spaghetti', 'it')).toEqual({ article: 'gli', core: 'spaghetti' });
    expect(splitArticle("un'amica", 'it')).toEqual({ article: "un'", core: 'amica' });
    expect(splitArticle('il caffè', 'es')).toEqual({ article: null, core: 'il caffè' });
  });
  it('апостроф с телефонной клавиатуры и пробел после l\'', () => {
    expect(normalize('L’acqua')).toBe("l'acqua");
    expect(normalize("l' acqua")).toBe("l'acqua");
    expect(normalize("un po' di pane")).toBe("un po' di pane");
  });
  it('буквы для ввода: апостроф и итальянские ударения', () => {
    expect(answerLetters("l'acqua", 'it')).toEqual({ letters: ['a', 'c', 'l', 'q', 'u', "'"], space: false });
    expect(answerLetters('il caffè', 'it').letters).toContain('è');
    expect(stripAccents('città perché')).toBe('citta perche');
  });
});

describe('checkPhrase', () => {
  const te = { es: '(Yo) quiero un té con leche.', alt: ['Un té con leche, por favor.'] };
  it('все варианты со скобками и alt верны, пунктуация и регистр не важны', () => {
    expect(checkPhrase('yo quiero un té con leche', te)).toMatchObject({ verdict: 'correct', expected: 'Yo quiero un té con leche.' });
    expect(checkPhrase('Quiero un té con leche!!', te).verdict).toBe('correct');
    expect(checkPhrase('un té con leche por favor', te).verdict).toBe('correct');
  });
  it('без ударения — почти', () => {
    expect(checkPhrase('quiero un te con leche', te)).toMatchObject({ verdict: 'almost', reason: 'accent' });
  });
  it('одна опечатка на 8 букв — почти, больше — неверно', () => {
    // «quiero un té con leche» — 18 букв: две опечатки прощаются, три — нет.
    expect(checkPhrase('quiero un té con lecje', te)).toMatchObject({ verdict: 'almost', reason: 'typo' });
    expect(checkPhrase('quero un té con lecje', te).verdict).toBe('almost');
    expect(checkPhrase('quero un té cn lecje', te).verdict).toBe('wrong');
  });
  it('короткая фраза опечаток не прощает, другая фраза неверна', () => {
    expect(checkPhrase('Hla', { es: 'Hola' }).verdict).toBe('wrong');
    expect(checkPhrase('La cuenta, por favor', { es: 'Un café, por favor.' }).verdict).toBe('wrong');
    expect(checkPhrase('', te).verdict).toBe('wrong');
  });
  it('итальянский апостроф с телефона', () => {
    expect(checkPhrase('Un bicchiere d’ acqua, per favore', { es: "Un bicchiere d'acqua, per favore." }).verdict).toBe('correct');
  });
});

describe('формы и сборка в грамматике', () => {
  it('форма: без опечаток, ударение — почти, alt засчитывается', () => {
    expect(checkForm('soy', ['soy']).verdict).toBe('correct');
    expect(checkForm('sois', ['soy']).verdict).toBe('wrong');
    expect(checkForm('esta', ['está']).verdict).toBe('almost');
    expect(checkForm('va', ['voy', 'va']).verdict).toBe('correct');
    expect(checkForm('  ', ['soy']).verdict).toBe('wrong');
  });
  it('сборка: порядок слов важен', () => {
    expect(checkBuilt(['yo', 'soy', 'Ana'], ['Yo soy Ana.']).verdict).toBe('correct');
    expect(checkBuilt(['soy', 'yo', 'Ana'], ['Yo soy Ana.']).verdict).toBe('wrong');
  });
});

describe('diagnose: почему неверно (задача 12.3)', () => {
  const kind = (...a: Parameters<typeof diagnose>) => diagnose(...a)?.kind;
  it('верный ответ и пустой ввод — причины нет', () => {
    expect(diagnose('el café', ['el café'], {}, 'es')).toBeUndefined();
    expect(diagnose('  ', ['el café'], {}, 'es')).toBeUndefined();
  });
  it('артикль: не тот или пропущен (es, it)', () => {
    expect(diagnose('la problema', ['el problema'], {}, 'es')).toEqual({ kind: 'article', text: 'Не тот артикль: правильно «el problema».' });
    expect(kind('problema', ['el problema'], {}, 'es')).toBe('article');
    expect(kind('il acqua', ["l'acqua"], {}, 'it')).toBe('article');
    expect(diagnose('acqua', ["l'acqua"], {}, 'it')?.text).toBe("Без артикля: существительное учим вместе с ним — «l'acqua».");
    expect(kind('lo problema', ['il problema'], {}, 'it')).toBe('article');
  });
  it('ударение: пропущено, лишнее, не на той букве (es, it)', () => {
    expect(diagnose('el cafe', ['el café'], {}, 'es')?.text).toBe('Пропущено ударение: «el café».');
    expect(diagnose('cómo', ['como'], {}, 'es')?.text).toBe('Лишнее ударение: «como».');
    // Не хватает буквы, а не ударения.
    expect(kind('cafè', ['caffè'], {}, 'it')).toBe('typo');
    expect(diagnose('perché', ['perchè'], {}, 'it')?.text).toBe('Ударение не на той букве: «perchè».');
    expect(kind('citta', ['città'], {}, 'it')).toBe('accent');
  });
  it('перепутано с другим словом урока (es, it)', () => {
    const others = [{ es: 'el té', ru: 'чай' }, { es: 'el café', ru: 'кофе' }];
    expect(diagnose('el té', ['el café'], { others }, 'es')).toEqual({ kind: 'confused', text: '«el té» — это «чай», другое слово.' });
    expect(kind('il tè', ['il caffè'], { others: [{ es: 'il tè', ru: 'чай' }] }, 'it')).toBe('confused');
    // Одна буква от верного, но это другое слово урока: «pero» — не опечатка в «perro».
    expect(kind('pero', ['perro'], { others: [{ es: 'pero', ru: 'но' }] }, 'es')).toBe('confused');
    expect(kind('pera', ['pero'], { others: [{ es: 'pera', ru: 'груша' }] }, 'it')).toBe('confused');
  });
  it('другая форма того же слова (es, it)', () => {
    const forms = [
      { form: 'hablo', label: 'yo · presente' },
      { form: 'hablas', label: 'tú · presente' },
    ];
    expect(diagnose('hablo', ['hablas'], { forms, typos: false }, 'es')).toEqual({
      kind: 'form',
      text: '«hablo» — это yo · presente, а здесь нужно tú · presente: «hablas».',
    });
    expect(kind('parlo', ['parli'], { forms: [{ form: 'parlo', label: 'io · presente' }], typos: false }, 'it')).toBe('form');
    // Форма нескольких лиц: названы все; нужная — из задания.
    const imp = [
      { form: 'hablaba', label: 'yo · imperfecto' },
      { form: 'hablabas', label: 'tú · imperfecto' },
      { form: 'hablaba', label: 'él · imperfecto' },
    ];
    expect(diagnose('hablaba', ['hablabas'], { forms: imp, target: 'tú · imperfecto', typos: false }, 'es')?.text).toBe(
      '«hablaba» — это yo · imperfecto или él · imperfecto, а здесь нужно tú · imperfecto: «hablabas».',
    );
  });
  it('опечатка — только где её прощают и только в одну букву (es, it)', () => {
    expect(kind('la mesra', ['la mesa'], {}, 'es')).toBe('typo');
    expect(kind('la finesra', ['la finestra'], {}, 'it')).toBe('typo');
    expect(kind('sois', ['soy'], { typos: false }, 'es')).toBeUndefined();
    expect(kind('el gato', ['el café'], {}, 'es')).toBeUndefined();
    // Короткое слово: одна буква — уже другое слово, причину не называем.
    expect(kind('el té', ['el tú'], {}, 'es')).toBeUndefined();
  });
});
