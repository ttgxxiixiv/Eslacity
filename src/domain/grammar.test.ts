import { describe, expect, it } from 'vitest';
import type { GrammarLesson } from '../content/schema';
import { seeded } from './generators';
import { answerGrammar, buildGrammarQueue, checkGrammar, forVariant, grammarScore, grammarTitle, rulesForReview, startGrammar, toItem } from './grammar';
import type { GrammarExercise } from '../content/schema';

const lesson: GrammarLesson = {
  id: 'a1.test', district: 'A1', order: 1, title: 'Тест',
  theory: [
    { kind: 'text', md: 'текст' },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['yo', 'soy'] }, { cells: ['vosotros', 'sois'], region: 'es' }] },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['vosotros', 'vuestro'], region: 'es' }] },
  ],
  examples: [],
  exercises: [
    { id: 'a1.test.1', kind: 'choose', prompt: 'yo', options: ['soy', 'es', 'eres'], answer: 0, explain: '' },
    { id: 'a1.test.2', kind: 'gap', sentence: 'Vosotros ___', ru: '', options: ['sois', 'son'], answer: 0, explain: '', region: 'es' },
    { id: 'a1.test.3', kind: 'truefalse', statement: 'x', answer: false, explain: '' },
  ],
};

describe('грамматика', () => {
  it('es-419 скрывает vosotros в таблицах и упражнениях', () => {
    const l = forVariant(lesson, false);
    expect(l.theory).toHaveLength(2);
    const t = l.theory[1];
    expect(t.kind === 'table' && t.rows.map((r) => r.cells[0])).toEqual(['yo']);
    expect(l.exercises.map((e) => e.kind)).toEqual(['choose', 'truefalse']);
    // Без упражнений vosotros номера остальных не сдвигаются: журнал пишет их под теми же id.
    expect(l.exercises.map((e) => e.id)).toEqual(['a1.test.1', 'a1.test.3']);
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

describe('правила в повторение', () => {
  const ex = (n: number) => ({ id: `a1.t.${n}`, kind: 'truefalse' as const, statement: 's', answer: true, explain: '' });
  const list = [1, 2, 3, 4, 5, 6].map(ex);

  it('ошибки идут с оценкой 1, случайные верные добирают до трёх', () => {
    const r = rulesForReview(list, new Set(['a1.t.2']), new Set(), seeded(1));
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ exerciseId: 'a1.t.2', grade: 1 });
    expect(r.slice(1).every((x) => x.grade === 4 && x.exerciseId !== 'a1.t.2')).toBe(true);
  });
  it('ошибок больше трёх — берутся все ошибки, случайных нет', () => {
    const r = rulesForReview(list, new Set(['a1.t.1', 'a1.t.3', 'a1.t.4', 'a1.t.6']), new Set(), seeded(1));
    expect(r.map((x) => x.grade)).toEqual([1, 1, 1, 1]);
  });
  it('у урока уже три карточки — при повторе добавляются только ошибки', () => {
    const three = new Set(['a1.t.1', 'a1.t.2', 'a1.t.3']);
    expect(rulesForReview(list, new Set(), three, seeded(1))).toEqual([]);
    expect(rulesForReview(list, new Set(['a1.t.5']), three, seeded(1))).toEqual([{ exerciseId: 'a1.t.5', grade: 1 }]);
    const one = rulesForReview(list, new Set(), new Set(['a1.t.1']), seeded(1));
    expect(one).toHaveLength(2);
    expect(one.some((x) => x.exerciseId === 'a1.t.1')).toBe(false);
  });
});

describe('продуктивные задания', () => {
  const build: GrammarExercise = {
    id: 'a1.test.4', kind: 'build', ru: 'Я студент из Мадрида.', answer: 'Soy estudiante de Madrid.', extra: ['eres', 'es'],
    alt: ['De Madrid soy estudiante.'], explain: 'ser',
  };
  const type: GrammarExercise = { id: 'a1.test.5', kind: 'type', sentence: 'Tú ___ médico.', ru: 'Ты врач.', hint: 'ser', answer: 'eres', explain: 'ser' };

  it('сборка: плитки — слова ответа и лишние; порядок важен, регистр и знаки нет; alt тоже верен', () => {
    const item = toItem(build, seeded(1));
    expect([...(item.tiles ?? [])].sort()).toEqual(['de', 'es', 'eres', 'estudiante', 'Madrid', 'soy'].sort());
    expect(checkGrammar(item, { tiles: ['soy', 'estudiante', 'de', 'Madrid'] })).toMatchObject({ verdict: 'correct', shown: 'Soy estudiante de Madrid.' });
    expect(checkGrammar(item, { tiles: ['de', 'Madrid', 'soy', 'estudiante'] }).verdict).toBe('correct');
    expect(checkGrammar(item, { tiles: ['estudiante', 'soy', 'de', 'Madrid'] }).verdict).toBe('wrong');
    expect(checkGrammar(item, { tiles: ['eres', 'estudiante', 'de', 'Madrid'] }).verdict).toBe('wrong');
    expect(checkGrammar(item, { tiles: [] }).verdict).toBe('wrong');
  });
  it('ввод формы: точная форма, без ударения — почти, опечатка — ошибка', () => {
    const item = toItem(type, seeded(1));
    expect(checkGrammar(item, { text: ' Eres ' })).toMatchObject({ verdict: 'correct', shown: 'Tú eres médico.', speak: 'Tú eres médico.' });
    expect(checkGrammar(item, { text: 'eras' }).verdict).toBe('wrong');
    const acc = toItem({ ...type, answer: 'está' }, seeded(1));
    const c = checkGrammar(acc, { text: 'esta' });
    expect(c).toMatchObject({ verdict: 'almost', reason: 'accent' });
    expect(grammarTitle(acc, c)).toBe('Почти');
  });
  it('выбор и верно/неверно через ту же проверку', () => {
    const q = buildGrammarQueue(lesson.exercises, seeded(3));
    expect(checkGrammar(q[0], { pick: q[0].answer })).toMatchObject({ verdict: 'correct', shown: 'soy' });
    const tf = q[2];
    const c = checkGrammar(tf, { pick: 1 - tf.answer });
    expect(c.verdict).toBe('wrong');
    expect(grammarTitle(tf, c)).toBe('Неверно, правильно: неверно');
    expect(checkGrammar(q[1], { pick: q[1].answer }).shown).toBe('Vosotros sois');
  });
  it('в уроке сборка и ввод идут после узнавания', () => {
    const q = buildGrammarQueue([type, build, ...lesson.exercises], seeded(5));
    expect(q.map((i) => i.ex.kind)).toEqual(['choose', 'gap', 'truefalse', 'build', 'type']);
  });
});
