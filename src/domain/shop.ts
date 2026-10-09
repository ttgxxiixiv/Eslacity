import { ECONOMY } from '../config';
import { RANKS, rankIndex } from './reputation';

/**
 * Лавка (задача 13.4, docs/GAME.md «Экономика»): на что тратить монеты, когда город построен. Расходники — жетоны
 * подсказки, заморозка стрика, подарки жителям; копить — на украшения зданий, которые иначе дают только золотые
 * медали. Цены растут с главой: доход зданий к концу пути в разы больше, чем в начале. Монеты не открывают учебный
 * материал: подарок жителю доступен с «Приятеля», то есть после того, как сюжетная миссия уже открыта поручениями.
 */

export type ShopItemId = 'hints' | 'freeze' | 'gift' | 'decor';

/** Множитель цен по главе: I — ×1, II — ×2, III — ×3, IV — ×5, V — ×8. */
export const PRICE_FACTOR = [1, 2, 3, 5, 8] as const;

/** Базовые цены главы I. Заморозка стоит одинаково всю игру: страховка стрика не должна дорожать. */
export const SHOP_BASE: Record<ShopItemId, number> = {
  hints: 30,
  freeze: ECONOMY.freezeCost,
  gift: 50,
  decor: 3000,
};

/** Жетонов в пакете. */
export const HINT_PACK = 3;
/** Подарок жителю: очков репутации и как часто одному жителю. */
export const GIFT_REP = 1;
export const GIFT_EVERY_DAYS = 7;
/** С какой ступени жителю можно дарить: с «Приятеля», когда миссия уже открыта. */
export const GIFT_RANK = 2;

export function priceFactor(chapter: number): number {
  return PRICE_FACTOR[Math.min(PRICE_FACTOR.length, Math.max(1, chapter)) - 1];
}

export function shopPrice(item: ShopItemId, chapter: number): number {
  return item === 'freeze' ? SHOP_BASE.freeze : SHOP_BASE[item] * priceFactor(chapter);
}

export type GiftState = { kind: 'locked'; rank: string } | { kind: 'ready' } | { kind: 'wait'; days: number };

/** Можно ли сегодня подарить жителю: ступень не ниже «Приятеля» и с прошлого подарка прошла неделя. */
export function giftState(points: number, lastGift: number | undefined, today: number): GiftState {
  if (rankIndex(points) < GIFT_RANK) return { kind: 'locked', rank: RANKS[GIFT_RANK].ru };
  if (lastGift !== undefined && today - lastGift < GIFT_EVERY_DAYS) return { kind: 'wait', days: GIFT_EVERY_DAYS - (today - lastGift) };
  return { kind: 'ready' };
}

/**
 * Неделя обычной игры по главам (для расчёта цен в docs/GAME.md и теста экономики). Допущения: раз в день игрок
 * заходит в город и собирает доход зданий за полные 8 часов, отвечает верно на 70 заданий, проходит один урок слов
 * и три поручения по 6 карточек. Здания: к главе I открыто 5 мест 2-го уровня, II — 10 мест 3-го, III — 15 мест
 * 4-го, IV и V — все 20 мест 5-го.
 */
export const TYPICAL_CITY: Record<number, { places: number; level: number }> = {
  1: { places: 5, level: 2 },
  2: { places: 10, level: 3 },
  3: { places: 15, level: 4 },
  4: { places: 20, level: 5 },
  5: { places: 20, level: 5 },
};

export function typicalWeekIncome(chapter: number): number {
  const city = TYPICAL_CITY[chapter];
  const buildings = city.places * ECONOMY.incomePerLevelPerHour * city.level * ECONOMY.incomeCapHours;
  const answers = 70 * ECONOMY.coinPerCorrect;
  const lesson = ECONOMY.lessonBonus;
  const errands = 3 * (10 + 6 * 2);
  return 7 * (buildings + answers + lesson + errands);
}
