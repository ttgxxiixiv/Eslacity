import { describe, expect, it } from 'vitest';
import type { Mission, MissionAnswer, Phrase } from '../content/schema';
import { seeded } from './generators';
import { answerNode, answersOnPath, isPassed, missionGraphIssues, missionOptions, modeForAttempt } from './mission';

const ph = (slug: string, es: string): Phrase => ({ id: `ph:cafe.${slug}`, es, ru: slug, level: 1 });
const phrases = Object.fromEntries(
  [ph('cafe', 'Un café, por favor.'), ph('te', '(Yo) quiero un té con leche.'), ph('cuenta', 'La cuenta, por favor.'), ph('agua', 'Un vaso de agua, por favor.'), ph('sin', 'Sin azúcar, gracias.')].map((p) => [p.id, p]),
);
const order: MissionAnswer = {
  kind: 'answer', task: 'Закажите кофе или чай',
  branches: [{ phrase: 'ph:cafe.cafe', next: 'coffee' }, { phrase: 'ph:cafe.te', next: 'tea' }],
  wrong: { es: '¿Un zapato?', ru: 'Ботинок?' },
};
const mission: Mission = {
  id: 'ms:cafe.1', chapter: 1, npc: 'lola', start: 'hi',
  nodes: {
    hi: { kind: 'say', es: '¿Qué quieres?', ru: 'Что хочешь?', next: 'order' },
    order,
    coffee: { kind: 'say', es: 'Aquí tienes.', ru: 'Держи.', next: 'bill' },
    tea: { kind: 'say', es: 'Un té.', ru: 'Чай.', next: 'bill' },
    bill: { kind: 'answer', task: 'Попросите счёт', branches: [{ phrase: 'ph:cafe.cuenta', next: 'bye' }], wrong: { es: '¿Qué?', ru: 'Что?' } },
    bye: { kind: 'say', es: '¡Adiós!', ru: 'Пока!' },
  },
};

describe('миссия', () => {
  it('режим по номеру прохождения: выбор, сборка, ввод', () => {
    expect([1, 2, 3, 7].map(modeForAttempt)).toEqual(['choose', 'tiles', 'type', 'type']);
  });
  it('засчитана при 80% верных', () => {
    expect([isPassed(4, 5), isPassed(3, 4), isPassed(0, 0), isPassed(5, 5)]).toEqual([true, false, false, true]);
  });
  it('выбор: фраза ветки ведёт по своей ветке, чужая — ошибка и основная ветка', () => {
    expect(answerNode(order, { kind: 'pick', phrase: 'ph:cafe.te' }, phrases)).toEqual({ verdict: 'correct', next: 'tea', phrase: 'ph:cafe.te' });
    expect(answerNode(order, { kind: 'pick', phrase: 'ph:cafe.cuenta' }, phrases)).toEqual({ verdict: 'wrong', next: 'coffee', phrase: 'ph:cafe.cafe' });
  });
  it('текст: любая ветка, «почти» засчитано', () => {
    expect(answerNode(order, { kind: 'text', text: 'quiero un té con leche' }, phrases).next).toBe('tea');
    expect(answerNode(order, { kind: 'text', text: 'un cafe por favor' }, phrases)).toMatchObject({ verdict: 'almost', next: 'coffee' });
    expect(answerNode(order, { kind: 'text', text: 'la cuenta' }, phrases).verdict).toBe('wrong');
  });
  it('варианты выбора: фразы веток и другие до четырёх', () => {
    const opts = missionOptions(order, Object.values(phrases), seeded(1));
    expect(opts).toHaveLength(4);
    expect(opts).toEqual(expect.arrayContaining(['ph:cafe.cafe', 'ph:cafe.te']));
  });
  it('ловушка не может быть тоже верным ответом: общее ключевое слово с веткой', () => {
    const iced = ph('hielo', 'Un café con hielo, por favor.');
    const pool = [...Object.values(phrases), iced];
    for (let seed = 1; seed < 30; seed++) expect(missionOptions(order, pool, seeded(seed))).not.toContain(iced.id);
  });
  it('граф: чистый, ответов на пути', () => {
    expect(missionGraphIssues(mission)).toEqual([]);
    expect(answersOnPath(mission)).toBe(2);
  });
  it('граф: пропущенный узел, недостижимый, цикл, нет старта', () => {
    const broken: Mission = { ...mission, nodes: { ...mission.nodes, bye: { kind: 'say', es: 'x', ru: 'x', next: 'hi' }, lost: { kind: 'say', es: 'x', ru: 'x', next: 'nowhere' } } };
    const issues = missionGraphIssues(broken).join('; ');
    expect(issues).toMatch(/"lost" ведёт в несуществующий "nowhere"/);
    expect(issues).toMatch(/цикл через "hi"/);
    expect(issues).toMatch(/узел "lost" недостижим/);
    expect(missionGraphIssues({ ...mission, start: 'x' })).toEqual(['нет стартового узла "x"']);
  });
});
