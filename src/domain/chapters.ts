/**
 * Путь героя (docs/GAME.md, раздел «Путь: пять глав»). Глава — уровень языка: свои уровни слов мест
 * и свои районы грамматики. Карта главы складывается из 20 обрывков (по одному от каждого места)
 * и печати стража. Чистая логика: контент и прогресс передаются снаружи.
 */

export type ChapterId = 1 | 2 | 3 | 4 | 5;

export interface Chapter {
  id: ChapterId;
  roman: 'I' | 'II' | 'III' | 'IV' | 'V';
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  /** Земля на карте странствий. */
  land: string;
  /** Уровни слов мест, которые входят в главу. */
  levels: number[];
  /** Районы грамматики главы. */
  districts: string[];
}

export const CHAPTERS: Chapter[] = [
  { id: 1, roman: 'I', cefr: 'A1', land: 'Окрестности города', levels: [1, 2], districts: ['A1'] },
  { id: 2, roman: 'II', cefr: 'A2', land: 'Горный перевал', levels: [3, 4], districts: ['A2'] },
  { id: 3, roman: 'III', cefr: 'B1', land: 'Пустыня миражей', levels: [5], districts: ['B1.1', 'B1.2'] },
  { id: 4, roman: 'IV', cefr: 'B2', land: 'Лес шёпотов', levels: [6], districts: ['B2'] },
  { id: 5, roman: 'V', cefr: 'C1', land: 'Лабиринт Эха', levels: [7], districts: ['C1'] },
];

export const chapterById = (id: number) => CHAPTERS.find((c) => c.id === id);

/**
 * Условия обрывка места. Включаются по мере выхода систем: `mission` — этап «Жители»,
 * `trial` — этап «Испытания».
 */
export type FragmentCondition = 'words' | 'mission' | 'trial';
export type Conditions = { fragment: Record<FragmentCondition, boolean>; seal: Record<SealCondition, boolean> };

/**
 * Условия печати земли. Пока стражей нет, печать даётся за все уроки района грамматики.
 * `scroll` — свиток земли выучен (задача про свитки), `guardian` — испытание стража (этап «Испытания»).
 */
export type SealCondition = 'grammar' | 'scroll' | 'guardian';

export const CONDITIONS: Conditions = {
  fragment: { words: true, mission: false, trial: false },
  seal: { grammar: true, scroll: false, guardian: false },
};

/** Всё, что нужно знать о контенте и прогрессе для расчёта пути. */
export interface JourneyInput {
  /** Места в порядке показа. */
  locations: string[];
  /** Место → уровень → id слов. */
  words: Record<string, Record<number, string[]>>;
  isLearned(wordId: string): boolean;
  /** Район → id уроков грамматики. */
  lessons: Record<string, string[]>;
  isLessonDone(lessonId: string): boolean;
}

/** Полученное: ключ → время получения. Полученное не отнимается, даже если условия стали строже. */
export interface JourneyRecord {
  fragments: Record<string, number>;
  seals: Record<string, number>;
}

export const EMPTY_JOURNEY: JourneyRecord = { fragments: {}, seals: {} };

export const fragmentKey = (chapter: ChapterId, location: string) => `${chapter}:${location}`;

export interface PlaceState {
  location: string;
  /** Обрывок уже записан как полученный. */
  got: boolean;
  /** Условия выполнены сейчас. */
  ready: boolean;
  /** Слов главы в месте всего и сколько ещё не выучено. */
  words: number;
  wordsLeft: number;
  /** Каких условий не хватает (пусто, если обрывок получен или готов). */
  missing: FragmentCondition[];
}

export interface ChapterState {
  chapter: Chapter;
  places: PlaceState[];
  /** Сколько обрывков получено или готово к получению. */
  fragments: number;
  seal: { got: boolean; ready: boolean; lessons: number; lessonsLeft: number; missing: SealCondition[] };
  /** Все обрывки и печать: карта земли собрана. */
  complete: boolean;
}

export interface JourneyState {
  chapters: ChapterState[];
  /** Первая глава, карта которой ещё не собрана. После пятой остаётся пятая. */
  current: ChapterId;
  /** Все пять карт собраны. */
  finished: boolean;
}

function placeState(ch: Chapter, location: string, input: JourneyInput, rec: JourneyRecord, cond: Conditions): PlaceState {
  const ids = ch.levels.flatMap((lvl) => input.words[location]?.[lvl] ?? []);
  const wordsLeft = ids.filter((id) => !input.isLearned(id)).length;
  const missing: FragmentCondition[] = [];
  // Пустой уровень (слов главы ещё нет в контенте) обрывка не даёт.
  if (cond.fragment.words && (ids.length === 0 || wordsLeft > 0)) missing.push('words');
  // mission и trial появятся со своими системами: пока включённое, но не сделанное условие не выполнено.
  if (cond.fragment.mission) missing.push('mission');
  if (cond.fragment.trial) missing.push('trial');
  const got = rec.fragments[fragmentKey(ch.id, location)] !== undefined;
  return { location, got, ready: !got && missing.length === 0, words: ids.length, wordsLeft, missing: got ? [] : missing };
}

export function journeyState(input: JourneyInput, rec: JourneyRecord, cond: Conditions = CONDITIONS): JourneyState {
  const chapters = CHAPTERS.map((chapter): ChapterState => {
    const places = input.locations.map((loc) => placeState(chapter, loc, input, rec, cond));
    const lessonIds = chapter.districts.flatMap((d) => input.lessons[d] ?? []);
    const lessonsLeft = lessonIds.filter((id) => !input.isLessonDone(id)).length;
    const missing: SealCondition[] = [];
    if (cond.seal.grammar && (lessonIds.length === 0 || lessonsLeft > 0)) missing.push('grammar');
    if (cond.seal.scroll) missing.push('scroll');
    if (cond.seal.guardian) missing.push('guardian');
    const got = rec.seals[String(chapter.id)] !== undefined;
    const seal = { got, ready: !got && missing.length === 0, lessons: lessonIds.length, lessonsLeft, missing: got ? [] : missing };
    const fragments = places.filter((p) => p.got || p.ready).length;
    return {
      chapter,
      places,
      fragments,
      seal,
      complete: fragments === input.locations.length && (seal.got || seal.ready),
    };
  });
  const open = chapters.find((c) => !c.complete);
  return { chapters, current: open?.chapter.id ?? 5, finished: !open };
}

export type JourneyAward = { kind: 'fragment'; chapter: ChapterId; location: string } | { kind: 'seal'; chapter: ChapterId };

/** Обрывки и печати, условия которых выполнены, но которые ещё не записаны. */
export function newAwards(state: JourneyState): JourneyAward[] {
  const out: JourneyAward[] = [];
  for (const c of state.chapters) {
    for (const p of c.places) if (p.ready) out.push({ kind: 'fragment', chapter: c.chapter.id, location: p.location });
    if (c.seal.ready) out.push({ kind: 'seal', chapter: c.chapter.id });
  }
  return out;
}

export function recordAwards(rec: JourneyRecord, awards: JourneyAward[], now: number): JourneyRecord {
  const fragments = { ...rec.fragments };
  const seals = { ...rec.seals };
  for (const a of awards) {
    if (a.kind === 'fragment') fragments[fragmentKey(a.chapter, a.location)] = now;
    else seals[String(a.chapter)] = now;
  }
  return { fragments, seals };
}

/** Всего полученных обрывков по всем главам: счётчик медали «Картограф». */
export const fragmentCount = (rec: JourneyRecord) => Object.keys(rec.fragments).length;
