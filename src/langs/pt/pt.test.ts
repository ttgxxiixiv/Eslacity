import { existsSync, readFileSync } from 'node:fs';
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
    for (const t of ['Eu vou do centro para a praia.', 'Ela mora na casa da avó.', 'Vamos à feira e ao mercado.', 'Passei pelo parque num dia de sol.', 'Preciso de uma cebola.', 'Moro em um apartamento.', 'A casa é bonita.', 'Para a escola, por favor.']) {
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

describe('кузница курса: глаголы из verbs.json', () => {
  const file = JSON.parse(readFileSync(new URL('../../content/pt/verbs.json', import.meta.url), 'utf8')) as { verbs: VerbData[] };
  const verb = (inf: string) => file.verbs.find((v) => v.inf === inf)!;

  it('у каждого глагола во всех временах шесть непустых форм', () => {
    for (const v of file.verbs) {
      for (const t of PT.verbs.tenses) expect(f(v, t.id).filter(Boolean), `${v.inf} ${t.id}`).toHaveLength(6);
    }
  });

  it('неправильные формы: записанные и выведенные из них', () => {
    expect(f(verb('fazer'), 'subjuntivo')[0]).toBe('faça');
    expect(f(verb('fazer'), 'futsubj')[0]).toBe('fizer');
    expect(f(verb('ter'), 'subjuntivo')[0]).toBe('tenha');
    expect(f(verb('vir'), 'futsubj')[5]).toBe('vierem');
    expect(f(verb('pôr'), 'futuro')[0]).toBe('porei');
    expect(f(verb('pôr'), 'infpessoal')[3]).toBe('pormos');
    expect(f(verb('sair'), 'futsubj')[5]).toBe('saírem');
    expect(f(verb('saber'), 'presente')[0]).toBe('sei');
    expect(f(verb('ver'), 'futsubj')[0]).toBe('vir');
    expect(PT.verbs.participle(verb('sair'))).toBe('saído');
  });
});

describe('уроки времён кузницы', () => {
  it('времена A1–A2 открываются уроками, которые уже есть в курсе', () => {
    const lesson = (id: string) => new URL(`../../content/pt/grammar/${id.split('.')[0]}/${id.split('.')[1]}.json`, import.meta.url);
    const early = PT.verbs.tenses.filter((t) => /^a[12]\./.test(t.lesson));
    expect(early.map((t) => t.id)).toEqual(['presente', 'perfeito', 'imperfeito']);
    for (const t of early) expect(existsSync(lesson(t.lesson)), t.lesson).toBe(true);
  });
});
