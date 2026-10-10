import { describe, expect, it } from 'vitest';
import type { LocationMeta, Word } from '../content/schema';
import { nextStep, nextStepWithLimit, recentLocation, stepPlace } from './next';

const locs: LocationMeta[] = [
  { id: 'cafe', ru: 'Кафе', emoji: '☕', unlockCost: 0 },
  { id: 'market', ru: 'Рынок', emoji: '🍅', unlockCost: 60 },
  { id: 'supermarket', ru: 'Супермаркет', emoji: '🛒', unlockCost: 80 },
];
// 10 слов на уровень: два урока по 5
const words = (loc: string, levels: number) =>
  Array.from({ length: levels * 10 }, (_, i) => ({ id: `${loc}.w${i}`, level: Math.floor(i / 10) + 1 }) as Word);
const learn = (ws: Word[]) => Object.fromEntries(ws.map((w) => [w.id, { learnedAt: 1 }]));

describe('кнопка «Продолжить»', () => {
  it('новичку предлагает первый урок кафе', () => {
    const s = nextStep({ locations: locs, levels: { cafe: 1 }, words: { cafe: words('cafe', 3) }, cards: {}, coins: 0 });
    expect(s).toEqual({ kind: 'learn', loc: 'cafe', level: 1, part: 0, newWords: 5 });
  });

  it('после первого урока — второй', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({ locations: locs, levels: { cafe: 1 }, words: { cafe }, cards: learn(cafe.slice(0, 5)), coins: 0 });
    expect(s).toMatchObject({ kind: 'learn', level: 1, part: 1 });
  });

  it('уровень выучен — улучшить здание, с недостающими монетами', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({ locations: locs, levels: { cafe: 1 }, words: { cafe }, cards: learn(cafe.slice(0, 10)), coins: 30 });
    expect(s).toEqual({ kind: 'upgrade', loc: 'cafe', toLevel: 2, cost: 80, missing: 50 });
  });

  it('недоученная локация важнее улучшения другой', () => {
    const cafe = words('cafe', 3);
    const market = words('market', 2);
    const s = nextStep({
      locations: locs, levels: { cafe: 1, market: 1 }, words: { cafe, market }, cards: learn(cafe.slice(0, 10)), coins: 500,
    });
    expect(s).toMatchObject({ kind: 'learn', loc: 'market', level: 1, part: 0 });
  });

  it('сначала проверяется локация, где учились последний раз', () => {
    const s = nextStep({
      locations: locs, levels: { cafe: 1, market: 1 }, words: { cafe: words('cafe', 1), market: words('market', 1) },
      cards: {}, coins: 0, recent: 'market',
    });
    expect(s).toMatchObject({ kind: 'learn', loc: 'market' });
  });

  it('всё открытое выучено до конца контента — открыть новое здание', () => {
    const cafe = words('cafe', 1);
    const s = nextStep({ locations: locs, levels: { cafe: 1 }, words: { cafe }, cards: learn(cafe), coins: 100 });
    expect(s).toEqual({ kind: 'unlock', loc: 'market', cost: 60, missing: 0 });
  });

  it('последняя локация по времени изучения', () => {
    expect(recentLocation({ 'cafe.a': { learnedAt: 5 }, 'market.b': { learnedAt: 9 } })).toBe('market');
    expect(recentLocation({})).toBeUndefined();
    // Слово свитка не место: берётся последнее слово места.
    expect(recentLocation({ 'cafe.a': { learnedAt: 5 }, 'scroll1.mapa': { learnedAt: 9 } })).toBe('cafe');
  });
});

describe('«Продолжить» и закрытые главы', () => {
  // Глава I — уровни 1–2, глава II — 3–4.
  const open1 = (level: number) => level <= 2;
  const chapterOf = (level: number) => (level <= 2 ? 1 : 2);
  const all = (loc: string) => ({ id: loc, ru: loc, emoji: '', unlockCost: 0 }) as LocationMeta;

  it('не ведёт в урок закрытого уровня, даже если здание прокачано', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({
      locations: [all('cafe')], levels: { cafe: 3 }, words: { cafe }, cards: learn(cafe.slice(0, 20)), coins: 0, isLevelOpen: open1, chapterOf,
    });
    expect(s).toEqual({ kind: 'chapter', next: 2 });
  });

  it('не предлагает улучшить здание до уровня закрытой главы, открытие нового места важнее', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({
      locations: locs, levels: { cafe: 2 }, words: { cafe }, cards: learn(cafe.slice(0, 20)), coins: 500, isLevelOpen: open1, chapterOf,
    });
    expect(s).toMatchObject({ kind: 'unlock', loc: 'market' });
  });

  it('всё открытое пройдено — ждём следующую главу', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({
      locations: [all('cafe')], levels: { cafe: 2 }, words: { cafe }, cards: learn(cafe.slice(0, 20)), coins: 500, isLevelOpen: open1, chapterOf,
    });
    expect(s).toEqual({ kind: 'chapter', next: 2 });
  });
});

describe('«Продолжить» и скидка жителя', () => {
  it('цена улучшения — со скидкой', () => {
    const cafe = words('cafe', 3);
    const s = nextStep({
      locations: locs, levels: { cafe: 1 }, words: { cafe }, cards: learn(cafe.slice(0, 10)), coins: 30,
      discount: (_, c) => Math.round(c * 0.9),
    });
    expect(s).toEqual({ kind: 'upgrade', loc: 'cafe', toLevel: 2, cost: 72, missing: 42 });
  });
});

describe('дневной лимит новых слов', () => {
  const cafe = words('cafe', 3);
  const base = { locations: locs, levels: { cafe: 1 }, words: { cafe }, cards: {}, coins: 0 };
  it('лимит не набран, повторов немного — урок', () => {
    expect(nextStepWithLimit({ ...base, limit: { newToday: 5, perDay: 10, due: 20 } })).toMatchObject({ kind: 'learn' });
  });
  it('новых сегодня уже по лимиту — сначала поручения, урок в запасе', () => {
    const s = nextStepWithLimit({ ...base, limit: { newToday: 10, perDay: 10, due: 3 } });
    expect(s).toMatchObject({ kind: 'errands', reason: 'limit', due: 3, then: { kind: 'learn', loc: 'cafe' } });
  });
  it('лимит набран, но повторять нечего — урок', () => {
    expect(nextStepWithLimit({ ...base, limit: { newToday: 10, perDay: 10, due: 0 } })).toMatchObject({ kind: 'learn' });
  });
  it('к повтору недельный запас (лимит × 21) — сначала повторение, урок в запасе', () => {
    expect(nextStepWithLimit({ ...base, limit: { newToday: 0, perDay: 10, due: 211 } })).toMatchObject({ kind: 'review', due: 211, then: { kind: 'learn', loc: 'cafe' } });
    expect(nextStepWithLimit({ ...base, limit: { newToday: 0, perDay: 10, due: 210 } })).toMatchObject({ kind: 'errands', reason: 'backlog' });
    expect(nextStepWithLimit({ ...base, limit: { newToday: 0, perDay: 5, due: 106 } })).toMatchObject({ kind: 'review' });
  });
  it('к повтору больше лимита × 5 — сначала поручения', () => {
    expect(nextStepWithLimit({ ...base, limit: { newToday: 0, perDay: 10, due: 51 } })).toMatchObject({ kind: 'errands', reason: 'backlog' });
    expect(nextStepWithLimit({ ...base, limit: { newToday: 0, perDay: 10, due: 50 } })).toMatchObject({ kind: 'learn' });
  });
  it('не урок новых слов — лимит не мешает', () => {
    const learned = learn(cafe.slice(0, 10));
    expect(nextStepWithLimit({ ...base, cards: learned, coins: 500, limit: { newToday: 99, perDay: 5, due: 999 } })).toMatchObject({ kind: 'upgrade' });
  });
});

describe('уровень 6: глава IV у здания 5-го уровня', () => {
  const allOpen = { cafe: 5, market: 5, supermarket: 5 };
  it('после уровня 5 — урок уровня 6, без улучшения здания', () => {
    const cafe = words('cafe', 6);
    const s = nextStep({ locations: locs, levels: allOpen, words: { cafe }, cards: learn(cafe.slice(0, 50)), coins: 9999 });
    expect(s).toMatchObject({ kind: 'learn', loc: 'cafe', level: 6, part: 0 });
  });
  it('глава IV закрыта — ждём главу, а не улучшаем здание до 6', () => {
    const cafe = words('cafe', 6);
    const s = nextStep({
      locations: locs.slice(0, 1), levels: { cafe: 5 }, words: { cafe }, cards: learn(cafe.slice(0, 50)), coins: 9999,
      isLevelOpen: (l) => l <= 5, chapterOf: (l) => (l >= 6 ? 4 : 3),
    });
    expect(s).toEqual({ kind: 'chapter', next: 4 });
  });
  it('здание ниже 5-го уровня уровень 6 не открывает', () => {
    const cafe = words('cafe', 6);
    const s = nextStep({ locations: locs.slice(0, 1), levels: { cafe: 4 }, words: { cafe }, cards: learn(cafe.slice(0, 40)), coins: 9999 });
    expect(s).toMatchObject({ kind: 'upgrade', toLevel: 5 });
  });
});

describe('предзагрузка места следующего шага', () => {
  it('урок, улучшение и открытие ведут в место, поручения — в место урока после них', () => {
    expect(stepPlace({ kind: 'learn', loc: 'cafe', level: 1, part: 0, newWords: 5 })).toBe('cafe');
    expect(stepPlace({ kind: 'unlock', loc: 'market', cost: 50, missing: 0 })).toBe('market');
    expect(stepPlace({ kind: 'errands', reason: 'limit', due: 3, then: { kind: 'upgrade', loc: 'park', toLevel: 2, cost: 10, missing: 0 } })).toBe('park');
    expect(stepPlace({ kind: 'review', due: 300, then: { kind: 'done' } })).toBeNull();
    expect(stepPlace({ kind: 'chapter', next: 2 })).toBeNull();
  });
});
