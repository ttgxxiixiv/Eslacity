import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../domain/generators';
import { checkGrammar, toItem, type GrammarInput } from '../domain/grammar';
import type { GrammarExercise, SphinxFile } from './schema';
import { SPHINX_SETS, SPHINX_WORD_MIX, validateSphinx } from './validate';

const real = (lang: string) => JSON.parse(readFileSync(join(import.meta.dirname, lang, 'sphinx.json'), 'utf8')) as SphinxFile;

/** Ввод, который даёт герой, если отвечает `answer`. */
function inputs(e: GrammarExercise): GrammarInput[] {
  switch (e.kind) {
    case 'transform': case 'type': return [e.answer, ...(e.alt ?? [])].map((text) => ({ text }));
    case 'fix': return [e.answer, ...(e.alt ?? [])].map((text) => ({ at: e.wrong, text }));
    case 'cloze': return [{ texts: e.answers.map((a) => a[0]) }, { texts: e.answers.map((a) => a[a.length - 1]) }];
    default: return [];
  }
}

describe.each(['es', 'it'])('Сфинкс, загадка слова: %s', (lang) => {
  const file = real(lang);
  it('три набора одинакового состава, валидатор без замечаний', () => {
    expect(file.word).toHaveLength(SPHINX_SETS);
    for (const set of file.word) {
      for (const [kind, n] of Object.entries(SPHINX_WORD_MIX)) expect(set.exercises.filter((e) => e.kind === kind), `${set.id} ${kind}`).toHaveLength(n);
    }
    expect(validateSphinx(file)).toEqual([]);
  });
  it('ответ и каждый alt засчитываются проверкой, чужое слово в fix — нет', () => {
    for (const set of file.word) {
      for (const e of set.exercises) {
        const item = toItem(e, seeded(1));
        for (const input of inputs(e)) expect(checkGrammar(item, input).verdict, `${e.id}: ${JSON.stringify(input)}`).toBe('correct');
        if (e.kind === 'fix') expect(checkGrammar(item, { at: (e.wrong + 1) % e.sentence.split(' ').length, text: e.answer }).verdict, e.id).toBe('wrong');
      }
    }
  });
});

describe('validateSphinx', () => {
  const set = (n: number, exercises: GrammarExercise[]) => ({ id: `sx:word.${n}`, exercises });
  const fix = (id: string, sentence = 'Espero que todo sale bien.'): GrammarExercise => ({ id, kind: 'fix', sentence, wrong: 3, answer: 'salga', explain: 'x' });
  const typ = (id: string, sentence: string): GrammarExercise => ({ id, kind: 'type', sentence, ru: 'x', answer: 'tomar', explain: 'x' });
  const msgs = (f: SphinxFile) => validateSphinx(f).map((x) => x.msg).join('; ');
  it('нет файла, мало наборов, неверные id', () => {
    expect(msgs(undefined as unknown as SphinxFile)).toMatch(/нет файла/);
    expect(msgs({ word: [set(2, [])] })).toMatch(/наборов 1, нужно 3.*id набора должен быть "sx:word.1"/);
    expect(msgs({ word: [set(1, [fix('sx:word.1.2')])] })).toMatch(/id задания должен быть "sx:word.1.1"/);
  });
  it('состав набора, вид без ввода, повтор задания между наборами', () => {
    const f = msgs({ word: [set(1, [fix('sx:word.1.1')]), set(2, [fix('sx:word.2.1')]), set(3, [{ id: 'sx:word.3.1', kind: 'truefalse', statement: 'x', answer: true, explain: 'x' }])] });
    expect(f).toMatch(/заданий transform: 0, нужно 3/);
    expect(f).toMatch(/вид "truefalse" не для загадки слова/);
    expect(f).toMatch(/задание уже есть в sx:word.1.1/);
  });
  it('задание проверяется как в уроке: ошибка fix и пропуск в type', () => {
    const f = msgs({ word: [set(1, [fix('sx:word.1.1', 'Espero que todo salga bien.'), typ('sx:word.1.2', 'Sin pропуска.')])] });
    expect(f).toMatch(/«salga» совпадает с верной формой/);
    expect(f).toMatch(/0 пропусков вместо одного/);
  });
  it('незнакомых слов больше 7% — ошибка', () => {
    const exercises = [fix('sx:word.1.1')];
    const out = validateSphinx({ word: [set(1, exercises)] }, { coverage: () => ({ total: 10, unknown: ['a', 'b'] }) });
    expect(out.map((x) => x.msg).join()).toMatch(/незнакомых слов 20% \(a, b\)/);
  });
});
