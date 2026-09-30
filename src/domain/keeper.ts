import { dayKey, retrievability, type SrsCard } from './srs';

/**
 * Хранитель (задача 8.4): после Эликсира его сила — средняя вероятность вспоминания всех карточек по FSRS.
 * Поручения и повторение держат её. Тридцать дней подряд выше 90% — титул «Хранитель языка». Сила может
 * падать, но полученный титул не отнимается.
 */

export const KEEPER_THRESHOLD = 0.9;
export const KEEPER_DAYS = 30;
export { KEEPER_TITLE } from './chapters';
/** Сколько дней замеров хранить: хватает на серию и немного истории. */
const KEEP_DAYS = 60;

export interface KeeperRecord {
  /** День (`dayKey`) → лучшая сила Эликсира за день, 0–1. */
  days: Record<string, number>;
  /** Когда получен титул «Хранитель языка». */
  title?: number;
}

export const EMPTY_KEEPER: KeeperRecord = { days: {} };

/** Сила Эликсира: средняя вероятность вспоминания карточек. Без карточек — 0. */
export function elixirStrength(cards: Iterable<SrsCard>, now: number): number {
  let sum = 0;
  let n = 0;
  for (const c of cards) {
    sum += retrievability(c, now);
    n++;
  }
  return n ? sum / n : 0;
}

const prevDay = (key: string) => dayKey(new Date(`${key}T12:00:00`).getTime() - 86_400_000);

/**
 * Дней подряд с силой не ниже 90%, считая назад от сегодня. Если сегодня ещё не было такого замера,
 * серия считается от вчера: день не кончился, и она ещё не прервана.
 */
export function keeperStreak(days: Record<string, number>, now: number): number {
  const ok = (k: string) => (days[k] ?? 0) >= KEEPER_THRESHOLD;
  let key = dayKey(now);
  if (!ok(key)) key = prevDay(key);
  let n = 0;
  while (ok(key)) {
    n++;
    key = prevDay(key);
  }
  return n;
}

/** Новый замер силы: за день хранится лучший, старые дни убираются, титул выдаётся на тридцатый день подряд. */
export function recordStrength(r: KeeperRecord, strength: number, now: number): KeeperRecord {
  const today = dayKey(now);
  const best = Math.max(r.days[today] ?? 0, strength);
  const earned = r.title === undefined && keeperStreak({ ...r.days, [today]: best }, now) >= KEEPER_DAYS;
  // Ничего не изменилось — та же запись, чтобы не писать в базу зря.
  if (r.days[today] === best && !earned) return r;
  const oldest = dayKey(now - KEEP_DAYS * 86_400_000);
  const days = Object.fromEntries(Object.entries({ ...r.days, [today]: best }).filter(([k]) => k > oldest));
  return earned ? { ...r, days, title: now } : { ...r, days };
}
