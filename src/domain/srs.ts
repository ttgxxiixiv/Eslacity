import { fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade as FsrsGrade } from 'ts-fsrs';
import type { Verdict } from './answer';

/**
 * Карточка слова. С версии 2.13.0 повторение планирует FSRS (библиотека ts-fsrs): стабильность — через сколько дней
 * вероятность вспомнить упадёт до 90%, сложность 1–10. Поля SM-2 (`ef`) остаются для старых копий и не меняются.
 */
export interface SrsCard {
  wordId: string;
  /** Коэффициент лёгкости SM-2 из прежней версии. Больше не обновляется. */
  ef: number;
  /** Интервал до следующего повтора в днях. */
  interval: number;
  /** Стабильность памяти FSRS в днях. */
  stability: number;
  /** Сложность FSRS, от 1 (лёгкое) до 10. */
  difficulty: number;
  /** Состояние FSRS: 0 новое, 1 изучается, 2 повторяется, 3 переучивается. */
  state: number;
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
  return {
    wordId, ef: 2.5, interval: 0, stability: 0, difficulty: 0, state: State.New,
    reps: 0, due: dayNumber(now), lapses: 0, learnedAt: now, lastReviewedAt: now,
  };
}

/**
 * FSRS: целевая вероятность вспомнить 0.9, параметры по умолчанию. Повторение идёт по дням,
 * поэтому коротких шагов внутри дня нет: новое слово после урока возвращается не раньше завтра.
 */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false, enable_short_term: false }));

/**
 * Перевод карточки SM-2 в FSRS (перенос базы и старых резервных копий): стабильность из интервала (не меньше 1),
 * сложность из лёгкости (2.5 → 5, 1.3 → 9), срок `due` не трогается, чтобы в день обновления не пришла лавина.
 */
export function fromSm2(card: Omit<SrsCard, 'stability' | 'difficulty' | 'state'> & Partial<SrsCard>): SrsCard {
  if (card.stability !== undefined && card.difficulty !== undefined && card.state !== undefined) return card as SrsCard;
  const ef = card.ef ?? 2.5;
  const difficulty = Math.min(10, Math.max(1, 5 + ((2.5 - ef) / 1.2) * 4));
  const learned = card.reps > 0 || card.interval > 0;
  return {
    ...card,
    ef,
    stability: learned ? Math.max(1, card.interval) : 0,
    difficulty: learned ? Math.round(difficulty * 100) / 100 : 0,
    state: learned ? State.Review : State.New,
  };
}

/** Оценка FSRS по оценке урока: неверно — Again, «почти» — Hard, верно — Good. */
function ratingOf(q: Grade): FsrsGrade {
  if (q < 3) return Rating.Again;
  if (q === 3) return Rating.Hard;
  return Rating.Good;
}

function toFsrs(c: SrsCard): FsrsCard {
  const seen = c.state !== State.New;
  return {
    due: new Date(c.lastReviewedAt),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: 0,
    scheduled_days: c.interval,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: 0,
    state: c.state as State,
    last_review: seen ? new Date(c.lastReviewedAt) : undefined,
  };
}

/** Один шаг повторения по FSRS. Срок — номер дня: сегодня плюс интервал, не меньше дня. */
export function review(card: SrsCard, q: Grade, now: number): SrsCard {
  const next = scheduler.next(toFsrs(fromSm2(card)), new Date(now), ratingOf(q)).card;
  const interval = Math.max(1, Math.round(next.scheduled_days));
  return {
    ...card,
    interval,
    stability: Math.round(next.stability * 1000) / 1000,
    difficulty: Math.round(next.difficulty * 1000) / 1000,
    state: next.state,
    reps: next.reps,
    lapses: next.lapses,
    due: dayNumber(now) + interval,
    lastReviewedAt: now,
  };
}

/** Вероятность вспомнить слово сейчас (0–1): для силы Эликсира и отчётов. У новой карточки — 0. */
export function retrievability(card: SrsCard, now: number): number {
  const c = fromSm2(card);
  if (c.state === State.New || c.stability <= 0) return 0;
  return scheduler.get_retrievability(toFsrs(c), new Date(now), false);
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
  return out.sort((a, b) => a.due - b.due || (b.difficulty ?? 0) - (a.difficulty ?? 0));
}
