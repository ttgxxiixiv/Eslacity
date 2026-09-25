import { describe, expect, it } from 'vitest';
import {
  CHAPTERS, CONDITIONS, EMPTY_JOURNEY, fragmentCount, journeyState, newAwards, recordAwards, type JourneyInput,
} from './chapters';

// Три места вместо двадцати: логика от числа мест не зависит.
const LOCS = ['cafe', 'market', 'park'];
const words = Object.fromEntries(
  LOCS.map((loc) => [loc, Object.fromEntries([1, 2, 3, 4, 5].map((lvl) => [lvl, [`${loc}.l${lvl}a`, `${loc}.l${lvl}b`]]))]),
);
const lessons = { A1: ['a1.1', 'a1.2'], A2: ['a2.1'], 'B1.1': ['b1.1'], 'B1.2': ['b12.1'], B2: ['b2.1'] };

function input(learned: string[], done: string[] = []): JourneyInput {
  const l = new Set(learned);
  const d = new Set(done);
  return { locations: LOCS, words, isLearned: (id) => l.has(id), lessons, isLessonDone: (id) => d.has(id) };
}
const chapterWords = (ch: number, loc: string) => CHAPTERS[ch - 1].levels.flatMap((lvl) => words[loc][lvl] ?? []);

describe('главы', () => {
  it('пять глав с уровнями слов и районами грамматики', () => {
    expect(CHAPTERS.map((c) => `${c.roman}:${c.levels.join('+')}:${c.districts.join('+')}`)).toEqual([
      'I:1+2:A1', 'II:3+4:A2', 'III:5:B1.1+B1.2', 'IV:6:B2', 'V:7:C1',
    ]);
  });
});

describe('состояние пути', () => {
  it('пустой прогресс: ничего нет, текущая глава I', () => {
    const s = journeyState(input([]), EMPTY_JOURNEY);
    expect(s.current).toBe(1);
    expect(s.chapters[0].fragments).toBe(0);
    expect(s.chapters[0].places[0]).toMatchObject({ location: 'cafe', got: false, ready: false, words: 4, wordsLeft: 4, missing: ['words'] });
    expect(s.chapters[0].seal).toMatchObject({ ready: false, lessons: 2, lessonsLeft: 2, missing: ['grammar'] });
    expect(newAwards(s)).toEqual([]);
  });

  it('частичный: обрывок за все слова главы в месте, половины уровня мало', () => {
    const s = journeyState(input([...chapterWords(1, 'cafe'), 'market.l1a']), EMPTY_JOURNEY);
    expect(s.chapters[0].places.map((p) => [p.location, p.ready, p.wordsLeft])).toEqual([
      ['cafe', true, 0], ['market', false, 3], ['park', false, 4],
    ]);
    expect(newAwards(s)).toEqual([{ kind: 'fragment', chapter: 1, location: 'cafe' }]);
    expect(s.current).toBe(1);
  });

  it('полная глава: все обрывки и печать, текущей становится следующая', () => {
    const learned = LOCS.flatMap((loc) => chapterWords(1, loc));
    const s = journeyState(input(learned, ['a1.1', 'a1.2']), EMPTY_JOURNEY);
    expect(s.chapters[0]).toMatchObject({ fragments: 3, complete: true });
    expect(newAwards(s)).toHaveLength(4);
    expect(s.current).toBe(2);
    const rec = recordAwards(EMPTY_JOURNEY, newAwards(s), 100);
    expect(rec.fragments).toEqual({ '1:cafe': 100, '1:market': 100, '1:park': 100 });
    expect(rec.seals).toEqual({ '1': 100 });
    expect(fragmentCount(rec)).toBe(3);
    // Записанное больше не выдаётся.
    expect(newAwards(journeyState(input(learned, ['a1.1', 'a1.2']), rec))).toEqual([]);
  });

  it('глава без слов и уроков в контенте обрывков и печати не даёт', () => {
    const all = LOCS.flatMap((loc) => [1, 2, 3, 4, 5].flatMap((lvl) => words[loc][lvl]));
    const s = journeyState(input(all, Object.values(lessons).flat()), EMPTY_JOURNEY);
    expect(s.chapters.slice(0, 3).every((c) => c.complete)).toBe(true);
    expect(s.chapters[3].places[0]).toMatchObject({ words: 0, ready: false, missing: ['words'] });
    expect(s.chapters[4].seal).toMatchObject({ lessons: 0, ready: false });
    expect(s.current).toBe(4);
    expect(s.finished).toBe(false);
  });

  it('новое условие не отнимает полученное', () => {
    const learned = chapterWords(1, 'cafe');
    const rec = recordAwards(EMPTY_JOURNEY, newAwards(journeyState(input(learned), EMPTY_JOURNEY)), 5);
    const stricter = { ...CONDITIONS, fragment: { words: true, mission: true, trial: false } };
    const s = journeyState(input([...learned, ...chapterWords(1, 'market')]), rec, stricter);
    const [cafe, market] = s.chapters[0].places;
    expect(cafe).toMatchObject({ got: true, ready: false, missing: [] });
    expect(market).toMatchObject({ got: false, ready: false, missing: ['mission'] });
    expect(s.chapters[0].fragments).toBe(1);
    expect(newAwards(s)).toEqual([]);
  });
});
