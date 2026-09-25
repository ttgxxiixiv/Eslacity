import { describe, expect, it } from 'vitest';
import type { Word } from '../content/schema';
import { seeded } from './generators';
import {
  advance, buildLearnSteps, buildReviewSteps, isFinished, makeStep, recordAnswer, startSession, type Step,
} from './lessonQueue';
import { makeChoice, makeScramble, makePhrase } from './generators';

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

  it('фраза: только слова примера, в другом порядке', () => {
    const p = makePhrase(words[5], seeded(4));
    expect(p.answer).toEqual(['muchas', 'gracias', 'señor']);
    expect(p.tokens.slice().sort()).toEqual(p.answer.slice().sort());
    expect(p.tokens).not.toEqual(p.answer);
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
