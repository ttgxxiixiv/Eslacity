import { describe, expect, it } from 'vitest';
import { activeFestival, easter, festivalOf, festivalsDone, festivalWeek, isFestivalOn, nextFestivalWeek, placePath } from './festival';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h).getTime();
const ymd = (x: Date) => `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;

describe('праздники', () => {
  it('Пасха считается верно', () => {
    expect(ymd(easter(2026))).toBe('2026-4-5');
    expect(ymd(easter(2027))).toBe('2027-3-28');
    expect(ymd(easter(2024))).toBe('2024-3-31');
  });

  it('недели праздников', () => {
    const tom = festivalWeek('tomatina', 2026);
    // Последняя среда августа 2026 — 26-е.
    expect([ymd(tom.start), ymd(tom.end)]).toEqual(['2026-8-23', '2026-8-29']);
    // Жирный вторник 2026 — 17 февраля.
    const car = festivalWeek('carnevale', 2026);
    expect([ymd(car.start), ymd(car.end)]).toEqual(['2026-2-11', '2026-2-17']);
    expect(ymd(festivalWeek('sanfermin', 2026).end)).toBe('2026-7-14');
  });

  it('праздник идёт весь последний день, у каждого языка свои', () => {
    expect(isFestivalOn('sanfermin', d(2026, 7, 14, 23))).toBe(true);
    expect(isFestivalOn('sanfermin', d(2026, 7, 15, 0))).toBe(false);
    expect(activeFestival('es', d(2026, 7, 10))?.id).toBe('sanfermin');
    expect(activeFestival('it', d(2026, 7, 10))).toBeUndefined();
    expect(activeFestival('it', d(2026, 8, 15))?.id).toBe('ferragosto');
    expect(activeFestival('es', d(2026, 10, 6))).toBeUndefined();
  });

  it('ближайшая неделя: эта или следующего года', () => {
    expect(nextFestivalWeek('sanfermin', d(2026, 7, 10)).start.getFullYear()).toBe(2026);
    expect(nextFestivalWeek('sanfermin', d(2026, 10, 6)).start.getFullYear()).toBe(2027);
  });

  it('праздник по id слова, фразы и миссии', () => {
    expect(festivalOf('fest-sanfermin.toro')).toBe('sanfermin');
    expect(festivalOf('ph:fest-tomatina.ole')).toBe('tomatina');
    expect(festivalOf('ms:fest-carnevale.2')).toBe('carnevale');
    expect(festivalOf('cafe.te')).toBeUndefined();
  });

  it('медаль — только за миссию, пройденную в неделю праздника', () => {
    expect(festivalsDone({ 'ms:fest-sanfermin.2': { done: d(2026, 7, 9) }, 'ms:fest-tomatina.2': { done: d(2026, 10, 1) } })).toEqual(['sanfermin']);
    expect(festivalsDone({ 'ms:fest-sanfermin.2': {} })).toEqual([]);
  });

  it('куда вернуться после урока: место, праздник, Летописец', () => {
    expect(placePath('cafe')).toBe('/loc/cafe');
    expect(placePath('fest-sanfermin')).toBe('/festival/sanfermin');
    expect(placePath('scroll2')).toBe('/journey-map');
  });
});
