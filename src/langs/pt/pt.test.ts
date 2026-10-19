import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../domain/answer';
import type { VerbData } from '../types';
import { PT } from '.';

const f = (v: VerbData, t: string) => PT.verbs.conjugate(v, t as never);

describe('спряжение правильных глаголов', () => {
  it('настоящее трёх групп', () => {
    expect(f({ inf: 'falar', ru: '' }, 'presente')).toEqual(['falo', 'falas', 'fala', 'falamos', 'falais', 'falam']);
    expect(f({ inf: 'comer', ru: '' }, 'presente')).toEqual(['como', 'comes', 'come', 'comemos', 'comeis', 'comem']);
    expect(f({ inf: 'partir', ru: '' }, 'presente')).toEqual(['parto', 'partes', 'parte', 'partimos', 'partis', 'partem']);
  });

  it('pretérito perfeito и imperfeito', () => {
    expect(f({ inf: 'falar', ru: '' }, 'perfeito')).toEqual(['falei', 'falaste', 'falou', 'falamos', 'falastes', 'falaram']);
    expect(f({ inf: 'comer', ru: '' }, 'perfeito')).toEqual(['comi', 'comeste', 'comeu', 'comemos', 'comestes', 'comeram']);
    expect(f({ inf: 'partir', ru: '' }, 'perfeito')).toEqual(['parti', 'partiste', 'partiu', 'partimos', 'partistes', 'partiram']);
    expect(f({ inf: 'falar', ru: '' }, 'imperfeito')).toEqual(['falava', 'falavas', 'falava', 'falávamos', 'faláveis', 'falavam']);
    expect(f({ inf: 'comer', ru: '' }, 'imperfeito')).toEqual(['comia', 'comias', 'comia', 'comíamos', 'comíeis', 'comiam']);
  });

  it('орфография перед e и перед o, a: fiquei, cheguei, comecei; conheço, conheça', () => {
    expect(f({ inf: 'ficar', ru: '' }, 'perfeito')[0]).toBe('fiquei');
    expect(f({ inf: 'chegar', ru: '' }, 'perfeito')[0]).toBe('cheguei');
    expect(f({ inf: 'começar', ru: '' }, 'perfeito')[0]).toBe('comecei');
    expect(f({ inf: 'ficar', ru: '' }, 'subjuntivo')).toEqual(['fique', 'fiques', 'fique', 'fiquemos', 'fiqueis', 'fiquem']);
    expect(f({ inf: 'conhecer', ru: '' }, 'presente')[0]).toBe('conheço');
    expect(f({ inf: 'conhecer', ru: '' }, 'subjuntivo')[0]).toBe('conheça');
  });

  it('будущее и условное от инфинитива или записанной основы', () => {
    expect(f({ inf: 'falar', ru: '' }, 'futuro')).toEqual(['falarei', 'falarás', 'falará', 'falaremos', 'falareis', 'falarão']);
    expect(f({ inf: 'fazer', ru: '', fut: 'far' }, 'futuro')[0]).toBe('farei');
    expect(f({ inf: 'dizer', ru: '', fut: 'dir' }, 'condicional')).toEqual(['diria', 'dirias', 'diria', 'diríamos', 'diríeis', 'diriam']);
  });

  it('subjuntivo от формы «eu»: durmo → durma, peço → peça, faço → faça', () => {
    expect(f({ inf: 'dormir', ru: '', yo: 'durmo' }, 'subjuntivo')[0]).toBe('durma');
    expect(f({ inf: 'pedir', ru: '', yo: 'peço' }, 'subjuntivo')).toEqual(['peça', 'peças', 'peça', 'peçamos', 'peçais', 'peçam']);
    expect(f({ inf: 'falar', ru: '' }, 'subjuntivo')).toEqual(['fale', 'fales', 'fale', 'falemos', 'faleis', 'falem']);
  });

  it('личный инфинитив и будущее сослагательного', () => {
    expect(f({ inf: 'falar', ru: '' }, 'infpessoal')).toEqual(['falar', 'falares', 'falar', 'falarmos', 'falardes', 'falarem']);
    expect(f({ inf: 'falar', ru: '' }, 'futsubj')).toEqual(['falar', 'falares', 'falar', 'falarmos', 'falardes', 'falarem']);
    // Основа будущего сослагательного — от перфекта: fizeram → fizer, foram → for.
    const fazer = { inf: 'fazer', ru: '', forms: { perfeito: ['fiz', 'fizeste', 'fez', 'fizemos', 'fizestes', 'fizeram'] } } as VerbData;
    expect(f(fazer, 'futsubj')).toEqual(['fizer', 'fizeres', 'fizer', 'fizermos', 'fizerdes', 'fizerem']);
    const ir = { inf: 'ir', ru: '', forms: { perfeito: ['fui', 'foste', 'foi', 'fomos', 'fostes', 'foram'] } } as VerbData;
    expect(f(ir, 'futsubj')[0]).toBe('for');
  });

  it('причастие: правильное или записанное', () => {
    expect(PT.verbs.participle({ inf: 'falar', ru: '' })).toBe('falado');
    expect(PT.verbs.participle({ inf: 'partir', ru: '' })).toBe('partido');
    expect(PT.verbs.participle({ inf: 'fazer', ru: '', pp: 'feito' })).toBe('feito');
  });

  it('кузница даёт бразильские лица: eu, você, nós, vocês', () => {
    expect(PT.verbs.used!.map((i) => PT.verbs.persons[i])).toEqual(['eu', 'você / ele / ela', 'nós', 'vocês / eles / elas']);
    expect(PT.verbs.infinitive.test('pôr')).toBe(true);
  });
});

describe('артикли и слияния', () => {
  it('артикль по роду', () => {
    expect(PT.articleIssue!('m', 'o', 'café')).toBeNull();
    expect(PT.articleIssue!('f', 'a', 'casa')).toBeNull();
    expect(PT.articleIssue!('f', 'o', 'casa')).not.toBeNull();
    expect(PT.articleIssue!('m', 'os', 'livros')).toBeNull();
  });

  it('раздельное написание предлога с артиклем — ошибка', () => {
    expect(PT.textIssues!('Eu vou de o centro.')).toEqual(['«de o» пишется слитно: «do»']);
    expect(PT.textIssues!('Estou em a praia.')).toEqual(['«em a» пишется слитно: «na»']);
    expect(PT.textIssues!('Passei por os campos.')).toEqual(['«por os» пишется слитно: «pelos»']);
    expect(PT.textIssues!('Vou a a feira.')).toEqual(['«a a» пишется слитно: «à»']);
    expect(PT.textIssues!('Dei o livro a o menino.')).toEqual(['«a o» пишется слитно: «ao»']);
  });

  it('правильные тексты без замечаний', () => {
    for (const t of ['Eu vou do centro para a praia.', 'Ela mora na casa da avó.', 'Vamos à feira e ao mercado.', 'Passei pelo parque num dia de sol.', 'A casa é bonita.', 'Para a escola, por favor.']) {
      expect(PT.textIssues!(t), t).toEqual([]);
    }
  });
});

describe('проверка ответа', () => {
  it('без знаков — «почти», с ними — верно', () => {
    expect(checkTyped('pao', ['pão']).verdict).toBe('almost');
    expect(checkTyped('você', ['você']).verdict).toBe('correct');
    expect(checkTyped('coracao', ['coração']).verdict).toBe('almost');
    expect(checkTyped('avo', ['avô']).verdict).toBe('almost');
  });
});
