import { create } from 'zustand';
import { lessonsOf } from '../content/grammar';
import { LOCATIONS } from '../content/locations';
import { WORD_LEVELS } from '../content/wordIndex';
import { db } from '../db/db';
import { persist } from '../db/persist';
import {
  CHAPTERS, EMPTY_JOURNEY, journeyState, newAwards, recordAwards,
  type JourneyAward, type JourneyInput, type JourneyRecord, type JourneyState,
} from '../domain/chapters';
import { useProgress } from './progress';

interface JourneyStore extends JourneyRecord {
  hydrate(d: Partial<JourneyRecord> | undefined): void;
  /** Записать обрывки и печати, условия которых выполнены. Возвращает только что полученные. */
  sync(now?: number): JourneyAward[];
}

/** Контент и прогресс для расчёта пути. */
export function journeyInput(): JourneyInput {
  const p = useProgress.getState();
  const districts = [...new Set(CHAPTERS.flatMap((c) => c.districts))];
  return {
    locations: LOCATIONS.map((l) => l.id),
    words: WORD_LEVELS,
    isLearned: (id) => id in p.cards,
    lessons: Object.fromEntries(districts.map((d) => [d, lessonsOf(d as never).map((l) => l.id)])),
    isLessonDone: (id) => !!p.grammar[id],
  };
}

export const useJourney = create<JourneyStore>((set, get) => ({
  ...EMPTY_JOURNEY,

  hydrate(d) {
    set({ fragments: { ...d?.fragments }, seals: { ...d?.seals } });
  },

  sync(now = Date.now()) {
    const { fragments, seals } = get();
    const awards = newAwards(journeyState(journeyInput(), { fragments, seals }));
    if (awards.length) {
      const next = recordAwards({ fragments, seals }, awards, now);
      set(next);
      persist(() => db.meta.put({ key: 'journey', value: next }));
    }
    return awards;
  },
}));

/** Текущее состояние пути: для экранов карты и главной. */
export function currentJourney(): JourneyState {
  const { fragments, seals } = useJourney.getState();
  return journeyState(journeyInput(), { fragments, seals });
}
