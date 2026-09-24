import { describe, expect, it } from 'vitest';
import type { GrammarLesson } from '../content/schema';
import { seeded } from './generators';
import { answerGrammar, buildGrammarQueue, forVariant, grammarScore, startGrammar } from './grammar';

const lesson: GrammarLesson = {
  id: 'a1.test', district: 'A1', order: 1, title: 'Тест',
  theory: [
    { kind: 'text', md: 'текст' },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['yo', 'soy'] }, { cells: ['vosotros', 'sois'], region: 'es' }] },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['vosotros', 'vuestro'], region: 'es' }] },
  ],
  examples: [],
  exercises: [
    { kind: 'choose', prompt: 'yo', options: ['soy', 'es', 'eres'], answer: 0, explain: '' },
    { kind: 'gap', sentence: 'Vosotros ___', ru: '', options: ['sois', 'son'], answer: 0, explain: '', region: 'es' },
    { kind: 'truefalse', statement: 'x', answer: false, explain: '' },
  ],
};

describe('грамматика', () => {
  it('es-419 скрывает vosotros в таблицах и упражнениях', () => {
    const l = forVariant(lesson, false);
    expect(l.theory).toHaveLength(2);
    const t = l.theory[1];
    expect(t.kind === 'table' && t.rows.map((r) => r.cells[0])).toEqual(['yo']);
    expect(l.exercises.map((e) => e.kind)).toEqual(['choose', 'truefalse']);
    expect(forVariant(lesson, true)).toBe(lesson);
  });

  it('варианты перемешаны, правильный индекс сохраняется', () => {
    for (let s = 1; s < 20; s++) {
      const q = buildGrammarQueue(lesson.exercises, seeded(s));
      expect(q.map((i) => i.ex.kind)).toEqual(['choose', 'gap', 'truefalse']);
      expect(q[0].options[q[0].answer]).toBe('soy');
      expect(q[2].options[q[2].answer]).toBe('Неверно');
    }
  });

  it('ошибка возвращает задание один раз, счёт по первым попыткам', () => {
    const rng = seeded(1);
    let r = startGrammar(buildGrammarQueue(lesson.exercises, rng));
    r = { ...answerGrammar(r, false, rng), index: 1 };
    expect(r.queue).toHaveLength(4);
    r = { ...answerGrammar(r, true, rng), index: 2 };
    r = { ...answerGrammar(r, true, rng), index: 3 };
    // повтор тоже ошибочный: больше не добавляется
    r = answerGrammar(r, false, rng);
    expect(r.queue).toHaveLength(4);
    expect(grammarScore(r)).toBe(67);
  });
});
