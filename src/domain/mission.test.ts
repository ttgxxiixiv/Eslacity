import { describe, expect, it } from 'vitest';
import type { Mission, MissionAnswer, Phrase } from '../content/schema';
import { seeded } from './generators';
import { answerNode, answersOnPath, isDispute, isPassed, isRegisterNode, missionGraphIssues, missionOptions, modeForAttempt, moveOf, offTone, withMove } from './mission';

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
  it('спор: три хода, у каждого своя реакция; выбор хода сводит узел к одной ветке', () => {
    const dispute: MissionAnswer = {
      kind: 'answer', task: 'Возразите, уступите или предложите компромисс',
      branches: [
        { phrase: 'ph:cafe.cafe', next: 'a', move: 'object' },
        { phrase: 'ph:cafe.te', next: 'b', move: 'concede' },
        { phrase: 'ph:cafe.agua', next: 'c', move: 'compromise' },
      ],
      wrong: { es: '¿Qué?', ru: 'Что?' },
    };
    const say = (next?: string) => ({ kind: 'say' as const, es: 'x', ru: 'x', next });
    const m: Mission = { id: 'ms:cafe.4', chapter: 4, npc: 'lola', start: 'd', nodes: { d: dispute, a: say('end'), b: say('end'), c: say('end'), end: say() } };
    expect(isDispute(dispute)).toBe(true);
    expect(isDispute(order)).toBe(false);
    expect(missionGraphIssues(m)).toEqual([]);
    expect(answerNode(dispute, { kind: 'pick', phrase: 'ph:cafe.agua' }, phrases)).toEqual({ verdict: 'correct', next: 'c', phrase: 'ph:cafe.agua' });
    expect(moveOf(dispute, 'ph:cafe.te')).toBe('concede');
    // В плитках и вводе ход выбран заранее: засчитывается только его фраза, ошибка ведёт по его ветке.
    const conceded = withMove(dispute, 'concede');
    expect(answerNode(conceded, { kind: 'text', text: 'Un café, por favor.' }, phrases)).toMatchObject({ verdict: 'wrong', next: 'b' });
    expect(answerNode(conceded, { kind: 'text', text: 'quiero un té con leche' }, phrases)).toMatchObject({ verdict: 'correct', next: 'b' });
    expect(withMove(dispute)).toBe(dispute);
    // Двух ходов мало, одна реакция на два хода — ошибка графа.
    const two = { ...dispute, branches: dispute.branches.slice(0, 2) };
    expect(missionGraphIssues({ ...m, nodes: { ...m.nodes, d: two } }).join()).toMatch(/нужны три ветки/);
    const same = { ...dispute, branches: dispute.branches.map((b) => ({ ...b, next: 'a' })) };
    expect(missionGraphIssues({ ...m, nodes: { ...m.nodes, d: same, b: say('end'), c: say('end') } }).join()).toMatch(/у каждого хода своя реакция/);
  });
});

describe('узел тона (глава V)', () => {
  const formal: Phrase = { id: 'ph:bank.le-ruego', es: 'Le ruego que revise mi cuenta.', ru: 'Прошу вас проверить мой счёт.', level: 7, register: 'formal' };
  const informal: Phrase = { id: 'ph:bank.mira-cuenta', es: 'Oye, mírame la cuenta.', ru: 'Слушай, глянь мой счёт.', level: 7, register: 'informal' };
  const neutral: Phrase = { id: 'ph:bank.revisar', es: 'Quiero revisar mi cuenta.', ru: 'Хочу проверить счёт.', level: 7, register: 'neutral' };
  const all = Object.fromEntries([formal, informal, neutral].map((p) => [p.id, p]));
  const node: MissionAnswer = {
    kind: 'answer', task: 'Попросите проверить счёт', register: 'formal',
    branches: [{ phrase: formal.id, next: 'ok' }, { phrase: informal.id, next: 'hurt' }],
    wrong: { es: '¿Perdón?', ru: 'Простите?' }, tone: { es: '¿«Oye»? Soy el director.', ru: '«Слушай»? Я директор.' },
  };

  it('нужный тон — верно, не тот — «почти» по своей ветке, нейтральный тон не обижает', () => {
    expect(isRegisterNode(node)).toBe(true);
    expect(answerNode(node, { kind: 'pick', phrase: formal.id }, all)).toEqual({ verdict: 'correct', next: 'ok', phrase: formal.id });
    expect(answerNode(node, { kind: 'pick', phrase: informal.id }, all)).toEqual({ verdict: 'almost', next: 'hurt', phrase: informal.id, offTone: true });
    expect(offTone(node, neutral)).toBe(false);
    expect(offTone({ ...node, register: undefined }, informal)).toBe(false);
  });

  it('в плитках и вводе: не тот тон — «почти», нужный тон с опечаткой лучше чужого тона', () => {
    expect(answerNode(node, { kind: 'text', text: 'Oye, mírame la cuenta' }, all)).toMatchObject({ verdict: 'almost', offTone: true });
    expect(answerNode(node, { kind: 'text', text: 'Le ruego que revise mi cuenta' }, all).verdict).toBe('correct');
    expect(answerNode(node, { kind: 'text', text: 'le ruego que revise mi cuanta' }, all)).toMatchObject({ verdict: 'almost', phrase: formal.id });
    expect(answerNode(node, { kind: 'text', text: 'Hola' }, all).verdict).toBe('wrong');
  });
});
