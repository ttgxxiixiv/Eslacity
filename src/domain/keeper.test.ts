import { describe, expect, it } from 'vitest';
import { EMPTY_KEEPER, elixirStrength, KEEPER_DAYS, keeperStreak, recordStrength, type KeeperRecord } from './keeper';
import { dayKey, newCard, review } from './srs';

const DAY = 86_400_000;
const T = new Date(2026, 8, 30, 12).getTime();
const days = (from: number, n: number, v: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [dayKey(from - i * DAY), v]));

describe('сила Эликсира', () => {
  it('средняя вероятность вспоминания; без карточек — 0', () => {
    expect(elixirStrength([], T)).toBe(0);
    const fresh = review(newCard('cafe.te', T), 5, T);
    expect(elixirStrength([fresh], T)).toBeCloseTo(1, 2);
    // Через полгода без повторения карточка помнится хуже.
    const later = elixirStrength([fresh], T + 180 * DAY);
    expect(later).toBeLessThan(0.9);
    expect(elixirStrength([fresh, fresh], T + 180 * DAY)).toBeCloseTo(later, 6);
  });
});

describe('серия дней выше 90%', () => {
  it('считается назад от сегодня, незаконченный сегодняшний день серию не рвёт', () => {
    expect(keeperStreak({}, T)).toBe(0);
    expect(keeperStreak(days(T, 5, 0.95), T)).toBe(5);
    // Сегодня замера ещё нет: серия от вчера.
    expect(keeperStreak(days(T - DAY, 4, 0.95), T)).toBe(4);
    // Сегодня ниже порога, но день не кончился: серия от вчера.
    expect(keeperStreak({ ...days(T - DAY, 4, 0.95), [dayKey(T)]: 0.8 }, T)).toBe(4);
    // Пропущенный или слабый день в середине рвёт серию.
    expect(keeperStreak({ ...days(T, 3, 0.95), ...days(T - 4 * DAY, 5, 0.95) }, T)).toBe(3);
    expect(keeperStreak({ ...days(T, 10, 0.95), [dayKey(T - 2 * DAY)]: 0.89 }, T)).toBe(2);
  });

  it('за день хранится лучший замер, без изменений запись та же', () => {
    const a = recordStrength(EMPTY_KEEPER, 0.85, T);
    const b = recordStrength(a, 0.92, T + 1000);
    expect(b.days[dayKey(T)]).toBe(0.92);
    expect(recordStrength(b, 0.9, T + 2000)).toBe(b);
  });

  it('тридцатый день подряд даёт титул, падение силы его не отнимает', () => {
    const r: KeeperRecord = { days: days(T - DAY, KEEPER_DAYS - 1, 0.93) };
    expect(recordStrength(r, 0.89, T).title).toBeUndefined();
    const got = recordStrength(r, 0.91, T);
    expect(got.title).toBe(T);
    const drop = recordStrength(got, 0.5, T + 5 * DAY);
    expect(drop.title).toBe(T);
    expect(keeperStreak(drop.days, T + 5 * DAY)).toBe(0);
  });

  it('старые дни убираются', () => {
    const r = recordStrength({ days: { '2020-01-01': 1 } }, 0.9, T);
    expect(Object.keys(r.days)).toEqual([dayKey(T)]);
  });
});
