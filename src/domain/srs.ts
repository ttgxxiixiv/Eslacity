import type { Verdict } from './answer';

export interface SrsCard {
  wordId: string;
  /** Коэффициент лёгкости SM-2, не ниже 1.3. */
  ef: number;
  /** Интервал в днях. */
  interval: number;
  reps: number;
  /** Номер локального дня, когда карточка становится доступной для повтора. */
  due: number;
  lapses: number;
  learnedAt: number;
  lastReviewedAt: number;
}

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

const DAY_MS = 86_400_000;

/** Номер дня по локальному календарю (не зависит от часа). */
export function dayNumber(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function newCard(wordId: string, now: number): SrsCard {
  return { wordId, ef: 2.5, interval: 0, reps: 0, due: dayNumber(now), lapses: 0, learnedAt: now, lastReviewedAt: now };
}

/** Один шаг SM-2. */
export function review(card: SrsCard, q: Grade, now: number): SrsCard {
  let { ef, interval, reps, lapses } = card;
  if (q < 3) {
    reps = 0;
    interval = 1;
    lapses += card.reps > 0 ? 1 : 0;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  ef = Math.round(ef * 1000) / 1000;
  return { ...card, ef, interval, reps, lapses, due: dayNumber(now) + interval, lastReviewedAt: now };
}

export function isDue(card: SrsCard, now: number): boolean {
  return card.due <= dayNumber(now);
}

/** Оценка SM-2 по результату одного упражнения. */
export function gradeFor(verdict: Verdict, typed: boolean): Grade {
  if (verdict === 'wrong') return 1;
  if (verdict === 'almost') return 3;
  return typed ? 5 : 4;
}

export function dueCards(cards: Iterable<SrsCard>, now: number): SrsCard[] {
  const today = dayNumber(now);
  const out: SrsCard[] = [];
  for (const c of cards) if (c.due <= today) out.push(c);
  // Сначала самые просроченные, при равенстве более трудные.
  return out.sort((a, b) => a.due - b.due || a.ef - b.ef);
}
