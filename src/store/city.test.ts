import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCity } from './city';
import { upgradeCost } from '../domain/economy';
import { LOCATION_BY_ID } from '../content/locations';

const H = 3_600_000;
const T = 1_700_000_000_000;

beforeEach(() => {
  useCity.getState().hydrate({ coins: 0, buildings: [{ locationId: 'cafe', level: 1, lastCollectedAt: T }] });
});

describe('город', () => {
  it('не открывает здание без монет', () => {
    expect(useCity.getState().upgrade('market', T)).toBe(false);
    expect(useCity.getState().buildings.market).toBeUndefined();
  });

  it('открывает здание и списывает цену', () => {
    useCity.getState().addCoins(100);
    expect(useCity.getState().upgrade('market', T)).toBe(true);
    const s = useCity.getState();
    expect(s.coins).toBe(40);
    expect(s.buildings.market).toMatchObject({ level: 1, lastCollectedAt: T });
  });

  it('собирает доход с лимитом 8 часов', () => {
    expect(useCity.getState().collect('cafe', T + 20 * H)).toBe(16);
    expect(useCity.getState().coins).toBe(16);
    expect(useCity.getState().collect('cafe', T + 20 * H)).toBe(0);
  });

  it('при улучшении сначала забирает доход по старой ставке', () => {
    // 5 ч × 2 монеты = 10, плюс 70 на руках = 80 = цена уровня 2 кафе
    useCity.getState().addCoins(70);
    expect(useCity.getState().upgrade('cafe', T + 5 * H)).toBe(true);
    const s = useCity.getState();
    expect(s.coins).toBe(0);
    expect(s.buildings.cafe).toMatchObject({ level: 2, lastCollectedAt: T + 5 * H });
  });

  it('собрать всё', () => {
    useCity.getState().hydrate({
      coins: 0,
      buildings: [
        { locationId: 'cafe', level: 1, lastCollectedAt: T },
        { locationId: 'market', level: 2, lastCollectedAt: T },
      ],
    });
    expect(useCity.getState().collectAll(T + 3 * H)).toBe(6 + 12);
  });
});

describe('скидка жителя', () => {
  it('улучшение со скидкой по репутации, открытие по полной цене', () => {
    useCity.getState().addCoins(1000);
    expect(useCity.getState().upgrade('market', T, 20)).toBe(true);
    expect(useCity.getState().coins).toBe(1000 - 60);
    const before = useCity.getState().coins;
    expect(useCity.getState().upgrade('market', T, 20)).toBe(true);
    // У Верного друга скидка 15%.
    expect(before - useCity.getState().coins).toBe(Math.round(upgradeCost(LOCATION_BY_ID.market, 2) * 0.85));
  });
});
