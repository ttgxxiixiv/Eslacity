import { create } from 'zustand';
import { db, emptyDay, type DayRow, type GrammarRow } from '../db/db';
import { persist } from '../db/persist';
import { dayKey, fromSm2, newCard, review, type Grade, type SrsCard } from '../domain/srs';
import { useMotivation } from './motivation';
import { useSettings } from './settings';
import { heroLevel } from '../domain/heroLevel';

type DayPatch = Partial<Omit<DayRow, 'date' | 'goalMet'>>;

interface ProgressState {
  cards: Record<string, SrsCard>;
  day: DayRow;
  /** Последние дни (для недельного челленджа и графика). */
  days: Record<string, DayRow>;
  xpTotal: number;
  /** Уровень, на который только что перешёл персонаж: для поздравления. */
  levelUp: number | null;
  grammar: Record<string, GrammarRow>;
  hydrate(p: { cards: SrsCard[]; days: DayRow[]; xpTotal: number; grammar: GrammarRow[] }): void;
  /** Отметить урок грамматики пройденным. Возвращает true, если пройден впервые. */
  completeGrammar(lessonId: string, score: number, now?: number): boolean;
  /** Проставить оценки SM-2. Новые слова получают карточку. */
  applyGrades(grades: Record<string, Grade>, now?: number): { newWords: number };
  /** Удалить карточки слов, которых больше нет в контенте. */
  dropCards(ids: string[]): void;
  addXp(n: number): void;
  clearLevelUp(): void;
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
  levelUp: null,
  grammar: {},

  hydrate({ cards, days, xpTotal, grammar }) {
    const key = dayKey(Date.now());
    set({
      // Карточки из старых резервных копий приходят без полей FSRS: достраиваем при загрузке.
      cards: Object.fromEntries(cards.map((c) => [c.wordId, fromSm2(c)])),
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
    // В недельный челлендж идут только новые уроки, иначе один урок можно пройти пять раз.
    if (!prev) get().bumpDay({ grammarLessons: 1 });
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

  dropCards(ids) {
    if (!ids.length) return;
    const cards = { ...get().cards };
    for (const id of ids) delete cards[id];
    set({ cards });
    persist(() => db.cards.bulkDelete(ids));
  },

  addXp(n) {
    if (!n) return;
    const before = heroLevel(get().xpTotal).level;
    const xpTotal = get().xpTotal + n;
    const after = heroLevel(xpTotal).level;
    set(after > before ? { xpTotal, levelUp: after } : { xpTotal });
    get().bumpDay({ xp: n });
    persist(() => db.meta.put({ key: 'xpTotal', value: xpTotal }));
  },

  clearLevelUp() {
    set({ levelUp: null });
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
