import { describe, expect, it } from 'vitest';
import type { Word } from '../content/schema';
import { seeded } from './generators';
import type { SrsCard } from './srs';
import {
  advance, buildLearnSteps, buildReviewSteps, isFinished, makeStep, recordAnswer, startSession, withoutListening, type Step,
} from './lessonQueue';
import { makeChoice, makeScramble, makePhrase, phraseTokens } from './generators';

const w = (id: string, es: string, ru: string, extra: Partial<Word> = {}): Word => ({
  id: `cafe.${id}`, es, ru, pos: 'noun', gender: 'm', level: 1, cefr: 'A1',
  example: { es: `Quiero ${es}.`, ru: 'пример' }, ...extra,
});

const words: Word[] = [
  w('cafe', 'el café', 'кофе'),
  w('te', 'el té', 'чай'),
  w('taza', 'la taza', 'чашка', { gender: 'f' }),
  w('leche', 'la leche', 'молоко', { gender: 'f' }),
  w('vaso', 'el vaso', 'стакан'),
  w('gracias', 'gracias', 'спасибо', { pos: 'interj', gender: undefined, example: { es: 'Muchas gracias, señor.', ru: '' } }),
];

describe('генераторы', () => {
  it('выбор: 4 уникальных варианта, правильный на своём индексе', () => {
    const c = makeChoice(words[0], words, 'es-ru', seeded(1));
    expect(c.options).toHaveLength(4);
    expect(new Set(c.options).size).toBe(4);
    expect(c.options[c.answer]).toBe('кофе');
  });

  it('дистракторы существительного берутся того же рода', () => {
    const c = makeChoice(words[0], words, 'ru-es', seeded(2));
    const others = c.options.filter((_, i) => i !== c.answer);
    // в пуле всего два других слова мужского рода, оба должны попасть в варианты
    expect(others.filter((o) => o.startsWith('el '))).toHaveLength(2);
  });

  it('буквы: переключатель артикля и перемешанные буквы', () => {
    const s = makeScramble(words[2], seeded(3));
    expect(s.articles).toEqual(['el', 'la']);
    expect(s.article).toBe('la');
    expect(s.letters.slice().sort()).toEqual([...'taza'].sort());
    expect(s.letters.join('')).not.toBe('taza');
  });

  it('фраза: тире в диалоге не попадает на плитки', () => {
    expect(phraseTokens('¿Algo más? —No, gracias.')).toEqual(['algo', 'más', 'No', 'gracias']);
  });

  it('фраза: только слова примера, в другом порядке', () => {
    const p = makePhrase(words[5], seeded(4));
    expect(p.answer).toEqual(['muchas', 'gracias', 'señor']);
    expect(p.tokens.slice().sort()).toEqual(p.answer.slice().sort());
    expect(p.tokens).not.toEqual(p.answer);
  });
});

describe('задания на слух', () => {
  it('урок включает выбор на слух и диктант', () => {
    const kinds = buildLearnSteps(words.slice(0, 5), words, seeded(11)).map((s) => s.kind);
    expect(kinds).toContain('listen-choice');
    expect(kinds.filter((k) => k === 'listen-type')).toHaveLength(2);
  });
  it('без звука заданий на слух нет', () => {
    const learn = buildLearnSteps(words.slice(0, 5), words, seeded(12), { listening: false });
    const review = buildReviewSteps(words, {}, words, seeded(13), { listening: false });
    expect([...learn, ...review].some((s) => s.kind.startsWith('listen'))).toBe(false);
  });
  it('«Не могу слушать» превращает задания в обычные', () => {
    const steps = withoutListening(buildLearnSteps(words.slice(0, 5), words, seeded(14)));
    expect(steps.some((s) => s.kind.startsWith('listen'))).toBe(false);
    const choice = steps.find((s) => s.kind === 'choice-es-ru');
    expect(choice && 'options' in choice && choice.options).toHaveLength(4);
  });
  it('диктант оценивается как ввод', () => {
    let s = startSession([makeStep('listen-type', words[0], words, seeded(15))]);
    s = recordAnswer(s, { verdict: 'correct' }, () => null);
    expect(s.grades['cafe.cafe']).toBe(5);
  });
});

describe('очередь урока', () => {
  it('урок новых слов: знакомство идёт раньше упражнений, ввод в конце', () => {
    const steps = buildLearnSteps(words.slice(0, 5), words, seeded(5));
    const kinds = steps.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'intro')).toHaveLength(5);
    expect(kinds).toContain('match');
    expect(kinds.slice(-5).every((k) => k === 'type')).toBe(true);
    for (const s of steps) {
      if (s.kind === 'intro' || s.kind === 'match') continue;
      const introAt = steps.findIndex((x) => x.kind === 'intro' && x.wordId === s.wordId);
      expect(introAt).toBeLessThan(steps.indexOf(s));
    }
  });

  it('ошибка возвращает слово в конец урока', () => {
    const rng = seeded(6);
    let s = startSession([makeStep('type', words[0], words, rng), makeStep('type', words[1], words, rng)]);
    const retry = (st: Step) => makeStep(st.kind as 'type', words.find((x) => 'wordId' in st && x.id === st.wordId)!, words, rng);
    s = recordAnswer(s, { verdict: 'wrong' }, retry);
    expect(s.steps).toHaveLength(3);
    const last = s.steps[2];
    expect(last.kind === 'type' && last.wordId).toBe('cafe.cafe');
    expect(s.mistakes).toEqual(['cafe.cafe']);
    s = advance(s);
    s = recordAnswer(s, { verdict: 'correct' }, retry);
    s = advance(s);
    expect(isFinished(s)).toBe(false);
    s = recordAnswer(s, { verdict: 'correct' }, retry);
    s = advance(s);
    expect(isFinished(s)).toBe(true);
    // оценка слова остаётся худшей за урок
    expect(s.grades['cafe.cafe']).toBe(1);
    expect(s.grades['cafe.te']).toBe(5);
  });

  it('«почти» засчитывается, но с оценкой 3 и без повтора', () => {
    let s = startSession([makeStep('type', words[0], words, seeded(7))]);
    s = recordAnswer(s, { verdict: 'almost' }, () => null);
    expect(s.steps).toHaveLength(1);
    expect(s.grades['cafe.cafe']).toBe(3);
  });

  it('пары ставят оценки по каждому слову', () => {
    const steps = buildReviewSteps(words.slice(0, 5), {}, words, seeded(8));
    expect(steps[0].kind).toBe('match');
    let s = startSession(steps);
    const m = steps[0];
    if (m.kind !== 'match') throw new Error();
    s = recordAnswer(s, { verdict: 'almost', perWord: { [m.wordIds[0]]: 'wrong' } }, () => null);
    expect(s.grades[m.wordIds[0]]).toBe(1);
    expect(s.grades[m.wordIds[1]]).toBe(4);
  });
});

describe('выражения C1 в поручениях', () => {
  const expr = (i: number): Word => ({
    id: `bank.e${i}`, es: `llevar a cabo ${i}`, ru: `провести ${i}`, pos: 'phrase', level: 7, cefr: 'C1', kind: 'collocation', register: 'formal',
    example: { es: 'x', ru: 'x' },
  });
  const list = Array.from({ length: 4 }, (_, i) => expr(i));
  const cards = Object.fromEntries(list.map((w) => [w.id, { wordId: w.id, interval: 3 } as SrsCard]));
  it('не новые выражения в поручении проверяются вводом, в обычном повторении — как все слова', () => {
    const errand = buildReviewSteps(list, cards, list, seeded(5), { listening: false, typeExpressions: true });
    expect(errand.every((s) => s.kind === 'type')).toBe(true);
    const review = buildReviewSteps(list, cards, list, seeded(5), { listening: false });
    expect(review.some((s) => s.kind !== 'type')).toBe(true);
  });
});

describe('разбор ошибок: вид задания задан (задача 12.2)', () => {
  it('у каждого слова свой вид, без «пар»; без звука — тот же вид без слуха', () => {
    const five = words.slice(0, 5);
    const kinds = { [five[0].id]: 'listen-type', [five[1].id]: 'type', [five[2].id]: 'choice-ru-es' } as const;
    const steps = buildReviewSteps(five, {}, words, seeded(3), { kinds });
    expect(steps.map((s) => s.kind).slice(0, 3)).toEqual(['listen-type', 'type', 'choice-ru-es']);
    expect(steps.some((s) => s.kind === 'match')).toBe(false);
    const quiet = buildReviewSteps(five, {}, words, seeded(3), { kinds, listening: false });
    expect(quiet[0].kind).toBe('type');
  });
});

describe('грубое слово (задача 15.2)', () => {
  it('ввод и сборка из букв заменяются выбором, на слух — выбором на слух', () => {
    const rude = w('rude', 'el grosero', 'грубость', { usage: 'vulgar', usageNote: 'грубое' });
    const pool = [...words, rude];
    expect(makeStep('type', rude, pool, seeded(1)).kind).toBe('choice-ru-es');
    expect(makeStep('scramble', rude, pool, seeded(1)).kind).toBe('choice-ru-es');
    expect(makeStep('listen-type', rude, pool, seeded(1)).kind).toBe('listen-choice');
    expect(makeStep('type', words[0], pool, seeded(1)).kind).toBe('type');
    const review = buildReviewSteps([rude], {}, pool, seeded(3), { listening: true });
    expect(review.some((s) => s.kind === 'type' || s.kind === 'listen-type' || s.kind === 'scramble')).toBe(false);
  });
});
