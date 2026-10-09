import { describe, expect, it } from 'vitest';
import type { GrammarLesson } from '../content/schema';
import { seeded } from './generators';
import { answerGrammar, buildGrammarQueue, checkGrammar, diagnoseGrammar, tableForms, fillGaps, grammarScore, grammarTitle, rulesForReview, startGrammar, toItem } from './grammar';
import type { GrammarExercise } from '../content/schema';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const lesson: GrammarLesson = {
  id: 'a1.test', district: 'A1', order: 1, title: 'Тест',
  theory: [
    { kind: 'text', md: 'текст' },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['yo', 'soy'] }, { cells: ['vosotros', 'sois'] }] },
    { kind: 'table', head: ['p', 'f'], rows: [{ cells: ['vosotros', 'vuestro'] }] },
  ],
  examples: [],
  exercises: [
    { id: 'a1.test.1', kind: 'choose', prompt: 'yo', options: ['soy', 'es', 'eres'], answer: 0, explain: '' },
    { id: 'a1.test.2', kind: 'gap', sentence: 'Vosotros ___', ru: '', options: ['sois', 'son'], answer: 0, explain: '' },
    { id: 'a1.test.3', kind: 'truefalse', statement: 'x', answer: false, explain: '' },
  ],
};

describe('грамматика', () => {
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

describe('задания C1 (задача 7.3) на обоих языках', () => {
  // Образцы лежат в последнем уроке района B2.
  const sample = (lang: 'es' | 'it') => {
    const dir = join(import.meta.dirname, '..', 'content', lang, 'grammar', 'b2');
    const f = readdirSync(dir).find((x) => x.startsWith('20-'))!;
    const l = JSON.parse(readFileSync(join(dir, f), 'utf8')) as GrammarLesson;
    return (kind: GrammarExercise['kind']) => toItem(l.exercises.find((e) => e.kind === kind)!, seeded(1));
  };
  for (const lang of ['es', 'it'] as const) {
    const get = sample(lang);
    it(`${lang}: в уроке есть все шесть видов`, () => {
      for (const k of ['transform', 'cloze', 'fix', 'register', 'combine', 'paraphrase'] as const) expect(get(k).ex.kind).toBe(k);
    });
    it(`${lang}: пересказ и связка — фраза целиком, регистр и знаки не важны, без ударения почти`, () => {
      for (const k of ['transform', 'combine'] as const) {
        const item = get(k);
        const ans = (item.ex as { answer: string }).answer;
        expect(checkGrammar(item, { text: ans.toUpperCase().replace(/[.,;:]/g, '') }).verdict).toBe('correct');
        expect(checkGrammar(item, { text: ans.normalize('NFD').replace(/\p{M}/gu, '') }).verdict).toBe(/[áéíóúàèìòù]/.test(ans) ? 'almost' : 'correct');
        expect(checkGrammar(item, { text: ans.replace(/\s\S+$/, '') }).verdict).toBe('wrong');
        expect(checkGrammar(item, { text: ans }).shown).toBe(ans);
      }
    });
    it(`${lang}: текст с пропусками — каждый пропуск по своему списку`, () => {
      const item = get('cloze');
      const ex = item.ex as Extract<GrammarExercise, { kind: 'cloze' }>;
      const right = ex.answers.map((a) => a[a.length - 1]);
      const c = checkGrammar(item, { texts: right });
      expect(c.verdict).toBe('correct');
      expect(c.shown).not.toContain('___');
      expect(checkGrammar(item, { texts: [right[0], 'xxx'] }).verdict).toBe('wrong');
      expect(checkGrammar(item, { texts: [right[0]] }).verdict).toBe('wrong');
    });
    it(`${lang}: ошибка — нужно и слово, и форма`, () => {
      const item = get('fix');
      const ex = item.ex as Extract<GrammarExercise, { kind: 'fix' }>;
      const c = checkGrammar(item, { at: ex.wrong, text: ex.answer });
      expect(c.verdict).toBe('correct');
      expect(c.shown).toContain(` ${ex.answer} `);
      expect(checkGrammar(item, { at: ex.wrong + 1, text: ex.answer }).verdict).toBe('wrong');
      expect(checkGrammar(item, { at: ex.wrong, text: 'xx' }).verdict).toBe('wrong');
      expect(checkGrammar(item, { text: ex.answer }).verdict).toBe('wrong');
    });
    it(`${lang}: регистр и тот же смысл — выбор или плитки`, () => {
      const reg = get('register');
      if (reg.tiles) {
        const answer = (reg.ex as { answer: string }).answer;
        expect(reg.tiles.length).toBeGreaterThan(answer.split(' ').length);
        expect(checkGrammar(reg, { tiles: answer.split(' ') }).verdict).toBe('correct');
        expect(checkGrammar(reg, { tiles: answer.split(' ').reverse() }).verdict).toBe('wrong');
      } else {
        expect(checkGrammar(reg, { pick: reg.answer }).verdict).toBe('correct');
        expect(checkGrammar(reg, { pick: (reg.answer + 1) % reg.options.length }).verdict).toBe('wrong');
      }
      const para = get('paraphrase');
      expect(checkGrammar(para, { pick: para.answer }).verdict).toBe('correct');
      expect(checkGrammar(para, { pick: (para.answer + 1) % para.options.length }).verdict).toBe('wrong');
    });
  }
  it('текст с пропусками: в начале предложения форма с заглавной', () => {
    expect(fillGaps('Llego tarde, ___, a las diez. ___, ¿has visto a Pedro?', ['es decir', 'por cierto'])).toBe('Llego tarde, es decir, a las diez. Por cierto, ¿has visto a Pedro?');
    expect(fillGaps('___ tardi, ___ alle dieci.', ['arrivo', 'cioè'])).toBe('Arrivo tardi, cioè alle dieci.');
  });
  it('в очереди урока узнавание раньше сборки, ввод в конце', () => {
    const kinds = ['combine', 'transform', 'cloze', 'fix', 'type', 'build', 'register', 'paraphrase', 'truefalse', 'gap', 'choose'] as const;
    // Поля не важны для порядка: у выбора есть варианты, у сборки — плитки, у ввода — ничего.
    const ex = (kind: (typeof kinds)[number], n: number) =>
      ({ id: `x.${n}`, kind, explain: '', ...(kind === 'build' ? { answer: 'a b c', extra: ['d'] } : kind === 'truefalse' ? { answer: true } : { options: ['a', 'b'], answer: 0 }) }) as unknown as GrammarExercise;
    const q = buildGrammarQueue(kinds.map((k, i) => ex(k, i)), seeded(3));
    expect(q.map((i) => i.ex.kind)).toEqual([...kinds].reverse());
  });
});

describe('почему неверно в грамматике (задача 12.3)', () => {
  const ser: GrammarLesson['theory'] = [
    { kind: 'table', head: ['Местоимение', 'ser'], rows: [{ cells: ['yo', 'soy'] }, { cells: ['tú', 'eres'] }, { cells: ['vosotros', 'sois'] }] },
    { kind: 'table', head: ['Пример', 'Перевод'], rows: [{ cells: ['Soy de Madrid.', 'Я из Мадрида.'] }] },
  ];
  const essere: GrammarLesson['theory'] = [
    { kind: 'table', head: ['', 'essere', 'avere'], rows: [{ cells: ['io', 'sono', 'ho'] }, { cells: ['tu', 'sei', 'hai'] }] },
  ];
  it('формы таблиц с подписью строки и столбца, примеры не формы', () => {
    expect(tableForms(ser)).toEqual([
      { form: 'soy', label: 'yo · ser' },
      { form: 'eres', label: 'tú · ser' },
      { form: 'sois', label: 'vosotros · ser' },
    ]);
    expect(tableForms(essere).map((f) => f.label)).toEqual(['io · essere', 'io · avere', 'tu · essere', 'tu · avere']);
  });
  it('ввод формы: другая форма из таблицы, ударение; опечатку не называем (es)', () => {
    const ex: GrammarExercise = { id: 'a1.t.1', kind: 'type', sentence: 'Tú ___ de Madrid.', ru: '', answer: 'eres', explain: '' };
    const item = toItem(ex, seeded(1));
    const why = (text: string) => diagnoseGrammar(item, { text }, checkGrammar(item, { text }), tableForms(ser));
    expect(why('soy')).toEqual({ kind: 'form', text: '«soy» — это yo · ser, а здесь нужно tú · ser: «eres».' });
    expect(why('eras')).toBeUndefined();
    expect(why('eres')).toBeUndefined();
  });
  it('выбор варианта: форма из таблицы и ударение (it)', () => {
    const ex: GrammarExercise = { id: 'a1.t.2', kind: 'gap', sentence: 'Io ___ stanco.', ru: '', options: ['sono', 'ho', 'sei'], answer: 0, explain: '' };
    const item = toItem(ex, seeded(2));
    const pickOf = (o: string) => item.options.indexOf(o);
    const why = (o: string) => diagnoseGrammar(item, { pick: pickOf(o) }, checkGrammar(item, { pick: pickOf(o) }), tableForms(essere));
    expect(why('ho')?.text).toBe('«ho» — это io · avere, а здесь нужно io · essere: «sono».');
    expect(why('sei')?.kind).toBe('form');
    const accent: GrammarExercise = { id: 'a1.t.3', kind: 'choose', prompt: 'Lui ___ qui.', options: ['è', 'e'], answer: 0, explain: '' };
    const a = toItem(accent, seeded(3));
    const i = a.options.indexOf('e');
    expect(diagnoseGrammar(a, { pick: i }, checkGrammar(a, { pick: i }))?.kind).toBe('accent');
  });
});
