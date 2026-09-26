import { describe, expect, it } from 'vitest';
import {
  errandItems, errandReward, errandSignal, errandText, planErrands, SCROLL_PLACE, type ErrandCard, type PlanInput,
} from './errands';

const T = 1000;
const card = (wordId: string, due: number, lapses = 0, difficulty = 5): ErrandCard => ({ wordId, due, lapses, difficulty });
/** n карточек места: первые due из них пора повторить. */
const place = (loc: string, n: number, due: number) =>
  Array.from({ length: n }, (_, i) => card(`${loc}.w${i}`, i < due ? T - (i % 3) : T + 5, i % 4, i % 7));
const input = (cards: ErrandCard[], extra: Partial<PlanInput> = {}): PlanInput => ({
  today: T, places: ['cafe', 'market', 'park', 'school', 'bank'], cards, active: [], last: {}, phrases: () => 3, ...extra,
});

describe('сборка поручения', () => {
  it('из карточек места, которые пора повторить, не больше 12', () => {
    const { items, due } = errandItems('words', 'cafe', [...place('cafe', 20, 15), ...place('market', 10, 10)], T);
    expect(due).toBe(15);
    expect(items).toHaveLength(12);
    expect(items.every((id) => id.startsWith('cafe.'))).toBe(true);
  });
  it('мало к повтору — добирает самые трудные до восьми', () => {
    const cards = [card('cafe.a', T), card('cafe.b', T + 3, 0), card('cafe.c', T + 3, 5), card('cafe.d', T + 3, 2), ...place('cafe', 8, 0)];
    const { items } = errandItems('words', 'cafe', cards, T);
    expect(items).toHaveLength(8);
    expect(items.slice(0, 3)).toEqual(['cafe.a', 'cafe.c', 'cafe.w3']);
  });
  it('учительница собирает правила из всех уроков', () => {
    const cards = [card('g:a1.02-ser.1', T), card('g:a2.01-x.3', T - 1), card('school.lapiz', T)];
    expect(errandItems('rules', 'school', cards, T).items).toEqual(['g:a2.01-x.3', 'g:a1.02-ser.1']);
  });
});

describe('план на день', () => {
  it('три поручения от разных жителей, у кого больше ждёт — первыми', () => {
    const cards = [...place('cafe', 12, 10), ...place('market', 12, 2), ...place('park', 12, 6), ...place('bank', 3, 3)];
    const plan = planErrands(input(cards));
    expect(plan).toHaveLength(3);
    expect(plan.map((e) => e.location)).toEqual(['cafe', 'park', 'market']);
    expect(new Set(plan.map((e) => e.location)).size).toBe(3);
    // Банк: всего три слова — поручение не собирается.
    expect(plan.some((e) => e.location === 'bank')).toBe(false);
    expect(plan[0]).toMatchObject({ id: `${T}:cafe`, day: T, kind: 'words' });
    expect(plan.every((e) => e.items.length >= 8 && e.items.length <= 12)).toBe(true);
  });
  it('один и тот же план весь день, формулировка — одна из трёх', () => {
    const cards = [...place('cafe', 12, 10), ...place('market', 12, 2), ...place('park', 12, 6)];
    expect(planErrands(input(cards))).toEqual(planErrands(input(cards)));
    for (const e of planErrands(input(cards))) expect([0, 1, 2]).toContain(e.phrase);
  });
  it('невыполненные остаются, новые — от других жителей до трёх', () => {
    const cards = [...place('cafe', 12, 10), ...place('market', 12, 8), ...place('park', 12, 6)];
    const old = planErrands(input(cards, { today: T - 1 })).filter((e) => e.location === 'market');
    const plan = planErrands(input(cards, { active: old }));
    expect(plan[0]).toEqual({ ...old[0] });
    expect(plan).toHaveLength(3);
    expect(plan.filter((e) => e.location === 'market')).toHaveLength(1);
  });
  it('чередование: жители, у которых поручение было вчера, уступают', () => {
    const cards = [...place('cafe', 12, 6), ...place('market', 12, 5), ...place('park', 12, 5), ...place('bank', 12, 5)];
    const plan = planErrands(input(cards, { last: { cafe: T - 1, market: T - 1 } }));
    expect(plan.map((e) => e.location)).toContain('park');
    expect(plan.map((e) => e.location)).toContain('bank');
  });
  it('учительница даёт правила, если они есть', () => {
    const cards = [...place('school', 10, 0), ...Array.from({ length: 6 }, (_, i) => card(`g:a1.02-ser.${i + 1}`, T))];
    const e = planErrands(input(cards)).find((x) => x.location === 'school')!;
    expect(e.kind).toBe('rules');
    expect(e.items.every((id) => id.startsWith('g:'))).toBe(true);
  });
  it('карточки, которых больше нет, выпадают из старого поручения', () => {
    const cards = place('cafe', 12, 12);
    const [e] = planErrands(input(cards, { places: ['cafe'] }));
    const plan = planErrands(input(cards.slice(0, 2), { places: ['cafe'], active: [e], today: T + 1 }));
    expect(plan).toEqual([]);
  });
});

describe('поручение Летописца', () => {
  const withScroll = { places: ['cafe', 'market', 'park', 'bank', SCROLL_PLACE] };
  const cities = [...place('cafe', 12, 10), ...place('market', 12, 8), ...place('park', 12, 6)];

  it('собирается из слов свитков, а не мест', () => {
    const cards = [...place('scroll1', 10, 3), ...place('cafe', 10, 10), card('g:a1.02-ser.1', T)];
    const { items, due } = errandItems('scroll', SCROLL_PLACE, cards, T);
    expect(due).toBe(3);
    expect(items).toHaveLength(8);
    expect(items.every((id) => id.startsWith('scroll1.'))).toBe(true);
  });
  it('свитку пора повториться — поручение Летописца среди трёх, первым', () => {
    const plan = planErrands(input([...cities, ...place('scroll1', 12, 1)], withScroll));
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ location: SCROLL_PLACE, kind: 'scroll' });
    expect(plan.map((e) => e.location)).toEqual([SCROLL_PLACE, 'cafe', 'market']);
  });
  it('повторять нечего — Летописец не просит, даже если слов свитка много', () => {
    const plan = planErrands(input([...cities, ...place('scroll1', 12, 0)], withScroll));
    expect(plan.map((e) => e.location)).not.toContain(SCROLL_PLACE);
  });
});

describe('текст, награда и знак', () => {
  it('число и склонения', () => {
    expect(errandText('Напомни {n} {слов}', 1)).toBe('Напомни 1 слово');
    expect(errandText('Напомни {n} {слов}', 3)).toBe('Напомни 3 слова');
    expect(errandText('Проверим {n} {правил}', 11)).toBe('Проверим 11 правил');
  });
  it('награда растёт с числом заданий, знак ярче при большем числе карточек', () => {
    expect(errandReward({ id: 'x', location: 'cafe', day: T, items: Array(10).fill('a'), phrase: 0, kind: 'words' })).toEqual({ coins: 30, rep: 1 });
    expect([errandSignal(false, 20), errandSignal(true, 0), errandSignal(true, 6), errandSignal(true, 12)]).toEqual([0, 1, 2, 3]);
  });
});
