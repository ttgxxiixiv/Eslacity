import { describe, expect, it } from 'vitest';
import { DECOR, unlockedDecor } from './decor';
import type { MedalsState } from './medals';
import { GIFT_EVERY_DAYS, giftState, HINT_PACK, priceFactor, shopPrice, typicalWeekIncome } from './shop';

const EMPTY_MEDALS: MedalsState = { lines: {}, secrets: {} };

describe('лавка: цены', () => {
  it('растут с главой, заморозка стоит одинаково', () => {
    expect([1, 2, 3, 4, 5].map(priceFactor)).toEqual([1, 2, 3, 5, 8]);
    expect(shopPrice('gift', 1)).toBe(50);
    expect(shopPrice('gift', 5)).toBe(400);
    expect(shopPrice('freeze', 1)).toBe(shopPrice('freeze', 5));
    expect(priceFactor(0)).toBe(1);
    expect(priceFactor(9)).toBe(8);
  });
});

describe('лавка: подарки жителям', () => {
  it('с «Приятеля», раз в неделю', () => {
    expect(giftState(4, undefined, 100)).toMatchObject({ kind: 'locked' });
    expect(giftState(5, undefined, 100)).toEqual({ kind: 'ready' });
    expect(giftState(5, 98, 100)).toEqual({ kind: 'wait', days: GIFT_EVERY_DAYS - 2 });
    expect(giftState(12, 100 - GIFT_EVERY_DAYS, 100)).toEqual({ kind: 'ready' });
  });
});

describe('экономика: неделя обычной игры (docs/GAME.md)', () => {
  it.each([1, 2, 3, 4, 5])('глава %i: расходники по карману, на украшение надо копить одну–три недели', (ch) => {
    const week = typicalWeekIncome(ch);
    // Обычная неделя трат: два пакета жетонов и подарки пяти приятелям.
    const basket = 2 * shopPrice('hints', ch) + 5 * shopPrice('gift', ch);
    expect(basket).toBeLessThan(week * 0.25);
    expect(basket).toBeGreaterThan(week * 0.02);
    const weeks = shopPrice('decor', ch) / week;
    expect(weeks).toBeGreaterThanOrEqual(1);
    expect(weeks).toBeLessThanOrEqual(3);
  });
  it('пакет жетонов не дороже одного дня ответов: подсказка — помощь, а не роскошь', () => {
    for (const ch of [1, 2, 3, 4, 5]) expect(shopPrice('hints', ch) / HINT_PACK).toBeLessThan(typicalWeekIncome(ch) / 7);
  });
});

describe('украшения: медаль или покупка', () => {
  it('купленное украшение открыто без медали', () => {
    expect(unlockedDecor(EMPTY_MEDALS)).toEqual([]);
    expect(unlockedDecor(EMPTY_MEDALS, ['typed', 'echo']).map((d) => d.line)).toEqual(['typed', 'echo']);
    expect(unlockedDecor(EMPTY_MEDALS, ['nope'])).toEqual([]);
    expect(DECOR).toHaveLength(12);
  });
});
