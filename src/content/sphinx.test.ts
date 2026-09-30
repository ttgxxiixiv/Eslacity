import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../domain/generators';
import { checkGrammar, toItem, type GrammarInput } from '../domain/grammar';
import type { GrammarExercise, SphinxFile, SphinxHearSet, SphinxWisdomSet } from './schema';
import { phraseTokens } from '../domain/phraseSteps';
import { SPHINX_HEAR_MIX, SPHINX_SETS, SPHINX_WISDOM_QUESTIONS, SPHINX_WORD_MIX, validateSphinx } from './validate';

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
    expect(msgs({ word: [set(2, [])], hear: [], wisdom: [] })).toMatch(/наборов 1, нужно 3.*id набора должен быть "sx:word.1"/);
    expect(msgs({ word: [set(1, [fix('sx:word.1.2')])], hear: [], wisdom: [] })).toMatch(/id задания должен быть "sx:word.1.1"/);
  });
  it('состав набора, вид без ввода, повтор задания между наборами', () => {
    const f = msgs({ word: [set(1, [fix('sx:word.1.1')]), set(2, [fix('sx:word.2.1')]), set(3, [{ id: 'sx:word.3.1', kind: 'truefalse', statement: 'x', answer: true, explain: 'x' }])], hear: [], wisdom: [] });
    expect(f).toMatch(/заданий transform: 0, нужно 3/);
    expect(f).toMatch(/вид "truefalse" не для загадки слова/);
    expect(f).toMatch(/задание уже есть в sx:word.1.1/);
  });
  it('задание проверяется как в уроке: ошибка fix и пропуск в type', () => {
    const f = msgs({ word: [set(1, [fix('sx:word.1.1', 'Espero que todo salga bien.'), typ('sx:word.1.2', 'Sin pропуска.')])], hear: [], wisdom: [] });
    expect(f).toMatch(/«salga» совпадает с верной формой/);
    expect(f).toMatch(/0 пропусков вместо одного/);
  });
  it('незнакомых слов больше 7% — ошибка', () => {
    const exercises = [fix('sx:word.1.1')];
    const out = validateSphinx({ word: [set(1, exercises)], hear: [], wisdom: [] }, { coverage: () => ({ total: 10, unknown: ['a', 'b'] }) });
    expect(out.map((x) => x.msg).join()).toMatch(/незнакомых слов 20% \(a, b\)/);
  });
});

describe.each(['es', 'it'])('Сфинкс, загадка слуха: %s', (lang) => {
  const file = real(lang);
  const npcs = JSON.parse(readFileSync(join(import.meta.dirname, lang, 'npcs.json'), 'utf8')) as { npcs: { id: string; voice: { pitch: number } }[] };
  const voices = { ...Object.fromEntries(npcs.npcs.map((n) => [n.id, n.voice.pitch])), cronista: 0.8 };
  it('три набора, одинаковый состав вопросов, голоса жителей, валидатор без замечаний', () => {
    expect(file.hear).toHaveLength(SPHINX_SETS);
    for (const set of file.hear!) {
      for (const [part, kinds] of Object.entries(SPHINX_HEAR_MIX)) {
        for (const [kind, n] of Object.entries(kinds)) expect(set.questions.filter((q) => q.part === part && q.kind === kind), `${set.id} ${part}/${kind}`).toHaveLength(n);
      }
    }
    expect(validateSphinx(file, { voices })).toEqual([]);
  });
  it('верный вариант стоит на разных местах', () => {
    const spots = new Set(file.hear!.flatMap((s) => s.questions.map((q) => q.answer)));
    expect(spots.size).toBeGreaterThanOrEqual(3);
  });
});

describe('validateSphinx: загадка слуха', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
  const q = (part: 'monologue' | 'dispute', kind: 'gist' | 'stance' | 'hint') => ({ q: 'x', options: ['a', 'b', 'c'], answer: 0, part, kind });
  const good = (n: number): SphinxHearSet => ({
    id: `sx:hear.${n}`,
    monologue: { who: 'cronista', lines: [{ es: words(160), ru: 'x' }] },
    dispute: Array.from({ length: 8 }, (_, i) => ({ who: i % 2 ? 'lola' : 'paco', es: `frase ${n} ${i}`, ru: 'x' })),
    questions: [q('monologue', 'gist'), q('monologue', 'gist'), q('monologue', 'stance'), q('monologue', 'hint'), q('dispute', 'gist'), q('dispute', 'stance'), q('dispute', 'stance'), q('dispute', 'hint')],
  });
  const voices = { cronista: 0.8, lola: 1.2, paco: 0.85, pilar: 1.2 };
  const hearMsgs = (hear: SphinxHearSet[], extra = {}) =>
    validateSphinx({ word: [], hear, wisdom: [] }, { voices, ...extra }).map((x) => x.msg).filter((m) => !m.startsWith('загадка слова') && !m.startsWith('загадка мудрости')).join('; ');
  it('правильные наборы проходят', () => {
    expect(hearMsgs([good(1), good(2), good(3)])).toBe('');
  });
  it('короткий монолог, чужой говорящий, спор одним голосом или одной высоты', () => {
    const short = { ...good(1), monologue: { who: 'nadie', lines: [{ es: words(20), ru: 'x' }] } };
    const one = { ...good(2), dispute: good(2).dispute.map((l) => ({ ...l, who: 'lola' })) };
    const same = { ...good(3), dispute: good(3).dispute.map((l) => ({ ...l, who: l.who === 'paco' ? 'pilar' : 'lola' })) };
    const m = hearMsgs([short, one, same]);
    expect(m).toMatch(/в монологе 20 слов, нужно 150–260/);
    expect(m).toMatch(/говорящий монолога "nadie" не житель/);
    expect(m).toMatch(/в споре 1 говорящих, нужно два/);
    expect(m).toMatch(/одинаковая высота голоса/);
  });
  it('состав вопросов, варианты и незнакомые слова без перевода', () => {
    const bad = { ...good(1), questions: [{ ...q('monologue', 'gist'), options: ['a', 'a', 'b'] }] };
    const m = hearMsgs([bad, good(2), good(3)], { coverage: () => ({ total: 100, unknown: ['zzz'] }) });
    expect(m).toMatch(/нужно 3–4 разных варианта/);
    expect(m).toMatch(/вопросов dispute\/stance: 0, нужно 2/);
    const warn = validateSphinx({ word: [], hear: [good(1)], wisdom: [] }, { voices, coverage: () => ({ total: 100, unknown: ['zzz'] }) });
    expect(warn.some((x) => x.level === 'warning' && /нет в словаре до уровня 7 и в gloss: zzz/.test(x.msg))).toBe(true);
  });
});

describe.each(['es', 'it'])('Сфинкс, загадка мудрости: %s', (lang) => {
  const file = real(lang);
  it('три набора: текст, пять вопросов, тон официальный и дружеский', () => {
    expect(file.wisdom).toHaveLength(SPHINX_SETS);
    for (const set of file.wisdom) {
      expect(set.questions, set.id).toHaveLength(SPHINX_WISDOM_QUESTIONS);
      expect(set.register.map((e) => (e.kind === 'register' ? e.to : '')).sort()).toEqual(['formal', 'informal']);
    }
  });
  it('ответ из плиток засчитывается, лишняя плитка вместо слова ответа — нет', () => {
    for (const set of file.wisdom) {
      for (const e of set.register) {
        if (e.kind !== 'register' || !('extra' in e)) throw new Error(e.id);
        const item = toItem(e, seeded(1));
        expect(checkGrammar(item, { tiles: phraseTokens(e.answer) }).verdict, e.id).toBe('correct');
        const words = phraseTokens(e.answer);
        for (const x of e.extra) expect(checkGrammar(item, { tiles: [x, ...words.slice(1)] }).verdict, `${e.id}: ${x}`).toBe('wrong');
      }
    }
  });
});

describe('validateSphinx: загадка мудрости', () => {
  const para = (n: number) => ({ es: Array.from({ length: n }, (_, i) => `palabra${i}`).join(' '), ru: 'x' });
  const q = () => ({ q: 'x', options: ['a', 'b', 'c'], answer: 1 });
  const reg = (id: string, to: 'formal' | 'informal', source: string): GrammarExercise => ({ id, kind: 'register', source, to, answer: 'podría usted venir mañana', extra: ['ven'], explain: 'x' });
  const good = (n: number): SphinxWisdomSet => ({
    id: `sx:wisdom.${n}`, title: 'Título', text: [para(420)], questions: [q(), q(), q(), q(), q()],
    register: [reg(`sx:wisdom.${n}.1`, 'formal', `ven mañana ${n}`), reg(`sx:wisdom.${n}.2`, 'informal', `le ruego ${n}`)],
  });
  const wisdomMsgs = (wisdom: SphinxWisdomSet[]) =>
    validateSphinx({ word: [], hear: [], wisdom }).map((x) => x.msg).filter((m) => !m.startsWith('загадка слова') && !m.startsWith('загадка слуха')).join('; ');
  it('правильные наборы проходят', () => {
    expect(wisdomMsgs([good(1), good(2), good(3)])).toBe('');
  });
  it('короткий текст, мало вопросов, два одинаковых тона, задание без плиток, повтор фразы', () => {
    const short = { ...good(1), text: [para(100)], questions: [q()] };
    const twice = { ...good(2), register: [reg('sx:wisdom.2.1', 'formal', 'a b c'), reg('sx:wisdom.2.2', 'formal', 'ven mañana 1')] };
    const opts = { ...good(3), register: [{ id: 'sx:wisdom.3.1', kind: 'register', source: 'x y z', to: 'formal', options: ['a', 'b'], answer: 0, explain: 'x' } as GrammarExercise, good(3).register[1]] };
    const m = wisdomMsgs([short, twice, opts]);
    expect(m).toMatch(/в тексте 100 слов, нужно 400–600/);
    expect(m).toMatch(/вопросов 1, нужно 5/);
    expect(m).toMatch(/задания тона: formal,formal, нужно одно formal и одно informal/);
    expect(m).toMatch(/фраза уже есть в sx:wisdom.1.1/);
    expect(m).toMatch(/нужно задание register с плитками/);
  });
});
