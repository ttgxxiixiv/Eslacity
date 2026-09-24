import { create } from 'zustand';
import { db, emptyDay, type DayRow, type GrammarRow } from '../db/db';
import { persist } from '../db/persist';
import { dayKey, newCard, review, type Grade, type SrsCard } from '../domain/srs';
import { useMotivation } from './motivation';
import { useSettings } from './settings';

type DayPatch = Partial<Omit<DayRow, 'date' | 'goalMet'>>;

interface ProgressState {
  cards: Record<string, SrsCard>;
  day: DayRow;
  /** Последние дни (для недельного челленджа и графика). */
  days: Record<string, DayRow>;
  xpTotal: number;
  grammar: Record<string, GrammarRow>;
  hydrate(p: { cards: SrsCard[]; days: DayRow[]; xpTotal: number; grammar: GrammarRow[] }): void;
  /** Отметить урок грамматики пройденным. Возвращает true, если пройден впервые. */
  completeGrammar(lessonId: string, score: number, now?: number): boolean;
  /** Проставить оценки SM-2. Новые слова получают карточку. */
  applyGrades(grades: Record<string, Grade>, now?: number): { newWords: number };
  addXp(n: number): void;
  bumpDay(patch: DayPatch): void;
}

function today(day: DayRow, now = Date.now()): DayRow {
  const key = dayKey(now);
  return day.date === key ? day : emptyDay(key);
}

export const useProgress = create<ProgressState>((set, get) => ({
  cards: {},
  day: emptyDay(dayKey(Date.now())),
  days: {},
  xpTotal: 0,
  grammar: {},

  hydrate({ cards, days, xpTotal, grammar }) {
    const key = dayKey(Date.now());
    set({
      cards: Object.fromEntries(cards.map((c) => [c.wordId, c])),
      day: days.find((d) => d.date === key) ?? emptyDay(key),
      days: Object.fromEntries(days.map((d) => [d.date, d])),
      xpTotal,
      grammar: Object.fromEntries(grammar.map((g) => [g.lessonId, g])),
    });
  },

  completeGrammar(lessonId, score, now = Date.now()) {
    const prev = get().grammar[lessonId];
    const row: GrammarRow = {
      lessonId,
      completedAt: prev?.completedAt ?? now,
      bestScore: Math.max(prev?.bestScore ?? 0, score),
    };
    set({ grammar: { ...get().grammar, [lessonId]: row } });
    get().bumpDay({ grammarLessons: 1 });
    persist(() => db.grammar.put(row));
    return !prev;
  },

  applyGrades(grades, now = Date.now()) {
    const cards = { ...get().cards };
    const changed: SrsCard[] = [];
    let newWords = 0;
    for (const [id, q] of Object.entries(grades)) {
      const prev = cards[id];
      if (!prev) newWords++;
      const next = review(prev ?? newCard(id, now), q, now);
      cards[id] = next;
      changed.push(next);
    }
    set({ cards });
    if (changed.length) persist(() => db.cards.bulkPut(changed));
    return { newWords };
  },

  addXp(n) {
    if (!n) return;
    const xpTotal = get().xpTotal + n;
    set({ xpTotal });
    get().bumpDay({ xp: n });
    persist(() => db.meta.put({ key: 'xpTotal', value: xpTotal }));
  },

  bumpDay(patch) {
    const d = { ...today(get().day) };
    for (const [k, v] of Object.entries(patch) as [keyof DayPatch, number][]) d[k] += v;
    const reached = !d.goalMet && d.xp >= useSettings.getState().dailyGoal;
    if (reached) d.goalMet = true;
    set({ day: d, days: { ...get().days, [d.date]: d } });
    persist(() => db.days.put(d));
    if (reached) useMotivation.getState().onGoalMet();
  },
}));
