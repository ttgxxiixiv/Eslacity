import { create } from 'zustand';
import { db, emptyDay, type DayRow } from '../db/db';
import { persist } from '../db/persist';
import { dayKey, newCard, review, type Grade, type SrsCard } from '../domain/srs';

type DayPatch = Partial<Omit<DayRow, 'date'>>;

interface ProgressState {
  cards: Record<string, SrsCard>;
  day: DayRow;
  xpTotal: number;
  hydrate(p: { cards: SrsCard[]; day: DayRow | undefined; xpTotal: number }): void;
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
  xpTotal: 0,

  hydrate({ cards, day, xpTotal }) {
    set({
      cards: Object.fromEntries(cards.map((c) => [c.wordId, c])),
      day: day ?? emptyDay(dayKey(Date.now())),
      xpTotal,
    });
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
    set({ day: d });
    persist(() => db.days.put(d));
  },
}));
