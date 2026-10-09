import { describe, expect, it } from 'vitest';
import type { LocationMissions, LocationScenes, Mission, Scene } from '../content/schema';
import { validateStory } from '../content/validate';
import { applySets, conditionGroups, EMPTY_STORY, heroEpithet, shownNode, storyAllows, visibleLines, withEpithet } from './story';

const fork = (chapter = 4): Mission => ({
  id: 'ms:hotel.4',
  chapter,
  npc: 'isabel',
  start: 'a',
  nodes: {
    a: {
      kind: 'answer',
      task: 'Спор',
      branches: [
        { phrase: 'ph:hotel.x', next: 'end', move: 'object', sets: { room: 'room' } },
        { phrase: 'ph:hotel.y', next: 'end', move: 'concede', sets: { room: 'refused' } },
        { phrase: 'ph:hotel.z', next: 'end', move: 'compromise', sets: { room: 'work' } },
      ],
      wrong: { es: '¿Qué?', ru: 'Что?' },
    },
    end: { kind: 'say', es: 'Bien.', ru: 'Хорошо.' },
  },
});

const scene = (lines: Scene['lines'], chapter = 5): Scene => ({ id: 'sc:hotel.5', chapter, npc: 'isabel', lines, questions: [] });
const line = (es: string, is?: string | null | (string | null)[]) => ({ who: 'npc', es, ru: es, ...(is !== undefined ? { if: { flag: 'room', is } } : {}) });

describe('флаги истории', () => {
  it('условие: значение, список, «не поставлен»', () => {
    expect(storyAllows(undefined, {})).toBe(true);
    expect(storyAllows({ flag: 'room', is: 'room' }, { room: 'room' })).toBe(true);
    expect(storyAllows({ flag: 'room', is: 'room' }, {})).toBe(false);
    expect(storyAllows({ flag: 'room', is: null }, {})).toBe(true);
    expect(storyAllows({ flag: 'room', is: ['work', 'room'] }, { room: 'work' })).toBe(true);
  });

  it('видимые реплики сохраняют номер в файле', () => {
    const lines = [line('a'), line('b', 'room'), line('c', 'refused'), line('d')];
    expect(visibleLines(lines, { room: 'refused' }).map((x) => [x.line.es, x.index])).toEqual([['a', 0], ['c', 2], ['d', 3]]);
    expect(visibleLines(lines, {}).map((x) => x.line.es)).toEqual(['a', 'd']);
  });

  it('флаг ставится один раз, ход спора запоминается', () => {
    const a = applySets(EMPTY_STORY, { room: 'refused' }, 'concede');
    expect(a).toEqual({ flags: { room: 'refused' }, moves: { room: 'concede' } });
    expect(applySets(a, { room: 'room' }, 'object')).toBe(a);
    expect(applySets(a, undefined)).toBe(a);
  });

  it('реплика миссии с условием пропускается', () => {
    const m = fork();
    m.nodes.end = { kind: 'say', es: 'A', ru: 'A', next: 'b', if: { flag: 'room', is: 'room' } };
    m.nodes.b = { kind: 'say', es: 'B', ru: 'B' };
    expect(shownNode(m, 'end', {})).toBe('b');
    expect(shownNode(m, 'end', { room: 'room' })).toBe('end');
    m.nodes.b = { kind: 'say', es: 'B', ru: 'B', if: { flag: 'room', is: 'work' } };
    expect(shownNode(m, 'end', {})).toBeUndefined();
  });

  it('приставка к титулу: большинство ходов, ничья, все три поровну', () => {
    expect(heroEpithet({ a: 'concede' })).toBeUndefined();
    expect(heroEpithet({ a: 'concede', b: 'concede' })).toBe('Чуткий');
    expect(heroEpithet({ a: 'object', b: 'concede' })).toBeUndefined();
    expect(heroEpithet({ a: 'object', b: 'concede', c: 'compromise' })).toBe('Непредсказуемый');
    expect(heroEpithet({ a: 'compromise', b: 'concede', c: 'compromise' })).toBe('Рассудительный');
    expect(withEpithet('Знаток', 'Прямодушный')).toBe('Прямодушный Знаток');
    expect(withEpithet('Знаток', undefined)).toBe('Знаток');
  });

  it('группы условий: подряд на один флаг', () => {
    const c = (flag: string, is: string) => ({ flag, is });
    expect(conditionGroups([undefined, c('a', 'x'), c('a', 'y'), undefined, c('a', 'z'), c('b', 'q')]).map((g) => g.map((x) => x.is))).toEqual([['x', 'y'], ['z'], ['q']]);
  });
});

describe('validateStory', () => {
  const run = (sc: Scene, m: Mission = fork()) =>
    validateStory([{ name: 'hotel.json', data: { location: 'hotel', scenes: [sc] } as LocationScenes }], [{ name: 'hotel.json', data: { location: 'hotel', missions: [m] } as LocationMissions }]).map((i) => i.msg);
  const full = [line('a'), line('r', 'room'), line('f', 'refused'), line('w', 'work')];

  it('все значения флага закрыты — без ошибок', () => {
    expect(run(scene(full))).toEqual([]);
    expect(run(scene([line('a'), line('r', ['room', 'work']), line('f', 'refused'), line('n', null)]))).toEqual([]);
  });

  it('незакрытое и повторённое значение, чужое значение, неизвестный флаг', () => {
    expect(run(scene([line('a'), line('r', 'room'), line('f', 'refused')]))).toEqual(['флаг "room": нет реплики для "work"']);
    expect(run(scene([...full, line('r2', 'room')]))).toEqual(['флаг "room": для "room" 2 реплики подряд']);
    expect(run(scene([...full.slice(0, 3), line('w', ['work', 'gone'])]))).toEqual(['у флага "room" нет значения "gone"']);
    expect(run(scene([line('a'), { who: 'npc', es: 'x', ru: 'x', if: { flag: 'nope', is: 'x' } }]))).toContain('флаг "nope" не ставит ни одна миссия');
  });

  it('флаг из той же главы, условие в шёпоте, сцена без реплик без условия', () => {
    expect(run(scene(full, 4))).toEqual(['флаг "room" ставится в главе 4, а реплика в главе 4: нужно позже']);
    expect(run({ ...scene(full), id: 'wh:hotel.4', mode: 'overhear' })).toContain('реплики с условием бывают только в обычных сценах');
    expect(run(scene(full.slice(1)))).toEqual(['в сцене нет реплик без условия']);
  });

  it('развилок в главе не меньше заданного', () => {
    const files = [{ name: 'hotel.json', data: { location: 'hotel', missions: [fork()] } as LocationMissions }];
    const sc = [{ name: 'hotel.json', data: { location: 'hotel', scenes: [scene(full)] } as LocationScenes }];
    expect(validateStory(sc, files, undefined, { chapters: [4], min: 1 })).toEqual([]);
    expect(validateStory(sc, files, undefined, { chapters: [3, 4], min: 2 }).map((i) => i.msg)).toEqual([
      'в главе 3 развилок 0, нужно не меньше 2',
      'в главе 4 развилок 1, нужно не меньше 2',
    ]);
  });

  it('развилка: одинаковые флаги у веток и разные значения; флаг без последствий', () => {
    const m = fork();
    const a = m.nodes.a as Extract<Mission['nodes'][string], { kind: 'answer' }>;
    a.branches[2] = { ...a.branches[2], sets: { room: 'room' } };
    expect(run(scene([line('a'), line('r', 'room'), line('f', 'refused')]), m)).toEqual(['развилка: у веток одинаковое значение флага "room"']);
    a.branches[2] = { ...a.branches[2], sets: undefined };
    expect(run(scene([line('a'), line('r', 'room'), line('f', 'refused')]), m)).toContain('развилка: каждая ветка ставит те же флаги');
    expect(run(scene([line('a')]))).toEqual(['флаг "room" не меняет ни одной реплики']);
  });

  it('реплики миссии с условием: цепочка по next закрывает все значения', () => {
    const say = (es: string, next?: string, is?: string): Mission['nodes'][string] => ({ kind: 'say', es, ru: es, next, ...(is ? { if: { flag: 'room', is } } : {}) });
    const later = (nodes: Mission['nodes']): Mission => ({ id: 'ms:hotel.5', chapter: 5, npc: 'isabel', start: 's', nodes });
    const files = (m: Mission) => [{ name: 'hotel.json', data: { location: 'hotel', missions: [fork(), m] } as LocationMissions }];
    const ok = later({ s: say('S', 'r'), r: say('R', 'f', 'room'), f: say('F', 'w', 'refused'), w: say('W', 'e', 'work'), e: say('E') });
    expect(validateStory([], files(ok))).toEqual([]);
    const gap = later({ s: say('S', 'r'), r: say('R', 'f', 'room'), f: say('F', 'e', 'refused'), e: say('E') });
    expect(validateStory([], files(gap)).map((i) => i.msg)).toEqual(['флаг "room": нет реплики для "work"']);
  });
});
