import { isRuleId } from './itemId';
import { plural } from './medals';

/**
 * Поручения жителей (docs/GAME.md, «Жители и миссии»): главный способ повторять. Каждый день три поручения
 * от разных жителей открытых мест. Поручение собирается из карточек места, которые пора повторить,
 * у учительницы школы — из правил грамматики. Если таких мало, добираются самые трудные карточки.
 * Поручения не сгорают: невыполненное переходит на следующий день.
 */

export const ERRANDS_PER_DAY = 3;
export const ERRAND_MIN = 8;
export const ERRAND_MAX = 12;
/** Меньше этого заданий поручение не собирается: место почти не изучено. */
export const ERRAND_FLOOR = 4;
/** Место учительницы: её поручения — правила грамматики. */
export const RULES_PLACE = 'school';

export interface Errand {
  /** `<день>:<место>` — одно поручение места в день. */
  id: string;
  location: string;
  /** День создания (номер дня). */
  day: number;
  /** Карточки поручения: id слов или правил. */
  items: string[];
  /** Какая из формулировок жителя. */
  phrase: number;
  kind: 'words' | 'rules';
}

export interface ErrandCard {
  wordId: string;
  due: number;
  lapses: number;
  difficulty?: number;
}

export interface PlanInput {
  today: number;
  /** Открытые места в порядке города. */
  places: string[];
  cards: ErrandCard[];
  /** Невыполненные поручения прошлых дней: остаются. */
  active: Errand[];
  /** Когда у места было последнее поручение: чтобы жители чередовались. */
  last: Record<string, number>;
  /** Сколько формулировок у жителя места. */
  phrases: (location: string) => number;
}

/** Детерминированное псевдослучайное число по строке: один и тот же план в течение дня. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const placeOf = (id: string) => id.split('.')[0];
/** Самые трудные: больше провалов, выше сложность. */
const harder = (a: ErrandCard, b: ErrandCard) => b.lapses - a.lapses || (b.difficulty ?? 0) - (a.difficulty ?? 0);

/**
 * Карточки поручения: слова места или все правила. Сначала те, что пора повторить (самые просроченные),
 * потом самые трудные, пока не наберётся восемь.
 */
export function errandItems(kind: Errand['kind'], location: string, cards: ErrandCard[], today: number): { items: string[]; due: number } {
  const own = cards.filter((c) => (kind === 'rules' ? isRuleId(c.wordId) : !isRuleId(c.wordId) && placeOf(c.wordId) === location));
  const due = own.filter((c) => c.due <= today).sort((a, b) => a.due - b.due || harder(a, b));
  const items = due.slice(0, ERRAND_MAX).map((c) => c.wordId);
  if (items.length < ERRAND_MIN) {
    const rest = own.filter((c) => c.due > today).sort(harder);
    for (const c of rest) {
      if (items.length >= ERRAND_MIN) break;
      items.push(c.wordId);
    }
  }
  return { items, due: due.length };
}

/**
 * План поручений на день. Невыполненные остаются (их карточки, которых больше нет, выпадают),
 * новые добавляются до трёх от других жителей. Выбор: больше карточек ждёт — выше, дольше не было поручения —
 * выше (чередование), при равенстве — случайно, но одинаково весь день.
 */
export function planErrands({ today, places, cards, active, last, phrases }: PlanInput): Errand[] {
  const exists = new Set(cards.map((c) => c.wordId));
  const kept = active
    .map((e) => ({ ...e, items: e.items.filter((id) => exists.has(id)) }))
    .filter((e) => e.items.length >= ERRAND_FLOOR);
  const busy = new Set(kept.map((e) => e.location));
  const hasRules = cards.some((c) => isRuleId(c.wordId));
  const candidates = places
    .filter((p) => !busy.has(p))
    .map((location) => {
      // Учительница даёт правила, если они есть; иначе, как все, слова своего места.
      const kind: Errand['kind'] = location === RULES_PLACE && hasRules ? 'rules' : 'words';
      const { items, due } = errandItems(kind, location, cards, today);
      const since = Math.min(7, today - (last[location] ?? today - 7));
      return { location, items, due, kind, score: due + since * 1.5 + hash(`${today}:${location}`) };
    })
    .filter((c) => c.items.length >= ERRAND_FLOOR)
    .sort((a, b) => b.score - a.score);
  const fresh = candidates.slice(0, Math.max(0, ERRANDS_PER_DAY - kept.length)).map((c) => ({
    id: `${today}:${c.location}`,
    location: c.location,
    day: today,
    items: c.items,
    phrase: Math.floor(hash(`${today}:${c.location}:p`) * Math.max(1, phrases(c.location))),
    kind: c.kind,
  }));
  return [...kept, ...fresh];
}

/** Текст просьбы: {n} — число заданий, {слов}/{правил} — слово в нужной форме. */
export function errandText(template: string, n: number): string {
  return template
    .replaceAll('{n}', String(n))
    .replaceAll('{слов}', plural(n, ['слово', 'слова', 'слов']))
    .replaceAll('{правил}', plural(n, ['правило', 'правила', 'правил']));
}

/** Награда за поручение: монеты растут с числом заданий. Репутация — одно очко у жителя. */
export function errandReward(e: Errand): { coins: number; rep: number } {
  return { coins: 10 + e.items.length * 2, rep: 1 };
}

/** Сила знака «!» над зданием: 0 — нет поручения, 1–3 — чем больше карточек ждёт, тем ярче. */
export function errandSignal(pending: boolean, due: number): 0 | 1 | 2 | 3 {
  if (!pending) return 0;
  return due >= 10 ? 3 : due >= 5 ? 2 : 1;
}
