import { useMemo } from 'react';
import { create } from 'zustand';
import { lessonsOf } from '../content/grammar';
import { LOCATIONS } from '../content/locations';
import { MISSION_CHAPTERS, SCROLL_WORDS, WORD_LEVELS } from '../content/wordIndex';
import { isMissionDone, useMissions } from './missions';
import { useTrials } from './trials';
import { useSphinx } from './sphinx';
import { useKeeper } from './keeper';
import { isTrialDone } from '../domain/trial';
import { isGuardianDone } from '../domain/guardian';
import { db } from '../db/db';
import { persist } from '../db/persist';
import {
  CHAPTERS, completedChapters, EMPTY_JOURNEY, fragmentKey, heroTitle, journeyState, newAwards, openedChapter, recordAwards, startedChapter,
  type ChapterId, type JourneyAward, type JourneyInput, type JourneyRecord, type JourneyState,
} from '../domain/chapters';
import { useCity } from './city';
import { wordIds } from '../domain/itemId';
import { useProgress } from './progress';

interface JourneyStore extends JourneyRecord {
  /** Открытая глава: её уровни слов и районы грамматики доступны, следующих — нет. */
  opened: ChapterId;
  hydrate(d: Partial<JourneyRecord> | undefined): void;
  /** Сцена перехода главы показана: больше не показывать. */
  celebrate(chapter: number): void;
  /** Записать обрывки и печати, условия которых выполнены. Возвращает только что полученные. */
  sync(now?: number): JourneyAward[];
  /**
   * Входной тест (задача 9.1): обрывки всех мест глав `fragmentChapters` и печати `sealChapters`. Полученное
   * раньше не меняется. Сцены перехода прошлых глав не показываются, кроме последней собранной.
   */
  grant(fragmentChapters: number[], sealChapters: number[], now?: number): void;
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
    scrolls: SCROLL_WORDS,
    missions: MISSION_CHAPTERS,
    isMissionDone: (place, chapter) => isMissionDone(useMissions.getState().records, place, chapter),
    isTrialDone: (place, chapter) => isTrialDone(useTrials.getState().records, place, chapter),
    isGuardianDone: (chapter) => isGuardianDone(useTrials.getState().records, chapter),
  };
}

export const useJourney = create<JourneyStore>((set, get) => ({
  ...EMPTY_JOURNEY,
  opened: 1,

  hydrate(d) {
    const rec: JourneyRecord = { fragments: { ...d?.fragments }, seals: { ...d?.seals } };
    // Прогресс до версии 2.7.0: глава не ниже всего, что уже начато, чтобы ничего не закрылось.
    rec.openedChapter = d?.openedChapter ?? startedChapter(startedInput());
    rec.celebrated = d?.celebrated ?? 0;
    set({ ...rec, opened: rec.openedChapter });
  },

  celebrate(chapter) {
    if (chapter <= (get().celebrated ?? 0)) return;
    set({ celebrated: chapter });
    const rec = record(get());
    persist(() => db.meta.put({ key: 'journey', value: rec }));
  },

  grant(fragmentChapters, sealChapters, now = Date.now()) {
    const fragments = { ...get().fragments };
    const seals = { ...get().seals };
    for (const c of fragmentChapters) for (const l of LOCATIONS) fragments[fragmentKey(c as ChapterId, l.id)] ??= now;
    for (const c of sealChapters) seals[String(c)] ??= now;
    const completed = completedChapters(journeyState(journeyInput(), { fragments, seals }));
    set({ fragments, seals, celebrated: Math.max(get().celebrated ?? 0, completed - 1) });
    get().sync(now);
  },

  sync(now = Date.now()) {
    const { fragments, seals, openedChapter: prev, celebrated } = get();
    const state = journeyState(journeyInput(), { fragments, seals });
    const awards = newAwards(state);
    const rec = recordAwards({ fragments, seals, openedChapter: prev, celebrated }, awards, now);
    const after = journeyState(journeyInput(), rec);
    rec.openedChapter = openedChapter(prev, after);
    set({ ...rec, opened: rec.openedChapter });
    // Записываем и при первом запуске, чтобы перенесённая глава сохранилась.
    persist(() => db.meta.put({ key: 'journey', value: rec }));
    return awards;
  },
}));

/** Запись пути для сохранения: без функций и производных полей. */
function record(s: JourneyRecord): JourneyRecord {
  return { fragments: s.fragments, seals: s.seals, openedChapter: s.openedChapter, celebrated: s.celebrated };
}

/** Титул героя по собранным картам. Пересчитывается при новых обрывках и печатях. */
export function useHeroTitle(): string {
  const fragments = useJourney((s) => s.fragments);
  const seals = useJourney((s) => s.seals);
  const sage = useSphinx((s) => s.rec.elixir !== undefined);
  const keeper = useKeeper((s) => s.rec.title !== undefined);
  return useMemo(() => heroTitle(completedChapters(currentJourney()), sage, keeper), [fragments, seals, sage, keeper]);
}

/** Что игрок уже начал: для переноса открытой главы. */
function startedInput() {
  const p = useProgress.getState();
  const levelOf = new Map<string, number>();
  for (const levels of Object.values(WORD_LEVELS)) for (const [lvl, ids] of Object.entries(levels)) for (const id of ids) levelOf.set(id, Number(lvl));
  const districtOf = new Map(CHAPTERS.flatMap((c) => c.districts).flatMap((d) => lessonsOf(d as never).map((l) => [l.id, d] as const)));
  return {
    wordLevels: wordIds(Object.keys(p.cards)).map((id) => levelOf.get(id) ?? 1),
    doneDistricts: Object.keys(p.grammar).map((id) => districtOf.get(id) ?? 'A1'),
    buildingLevels: Object.values(useCity.getState().buildings).map((b) => b?.level ?? 0),
  };
}

/** Текущее состояние пути: для экранов карты и главной. */
export function currentJourney(): JourneyState {
  const { fragments, seals } = useJourney.getState();
  return journeyState(journeyInput(), { fragments, seals });
}
