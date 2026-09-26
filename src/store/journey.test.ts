import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WORD_LEVELS } from '../content/wordIndex';
import type { SrsCard } from '../domain/srs';
import { currentJourney, useJourney } from './journey';
import { useCity } from './city';
import { useProgress } from './progress';
import { lessonsOf } from '../content/grammar';

const card = (wordId: string) => ({ wordId, ef: 2.5, interval: 1, reps: 1, due: 0, lapses: 0, learnedAt: 0, lastReviewedAt: 0 }) as SrsCard;

beforeEach(() => {
  useProgress.getState().hydrate({ cards: [], days: [], xpTotal: 0, grammar: [] });
  useCity.getState().hydrate({ coins: 0, buildings: [{ locationId: 'cafe', level: 1, lastCollectedAt: 0 }] });
  useJourney.getState().hydrate(undefined);
});

describe('путь по настоящему контенту', () => {
  it('индекс слов: в каждом месте есть слова уровней 1–5', () => {
    expect(Object.keys(WORD_LEVELS)).toHaveLength(20);
    for (const levels of Object.values(WORD_LEVELS)) for (const l of [1, 2, 3, 4, 5]) expect(levels[l]?.length).toBeGreaterThan(0);
  });

  it('перенос: обрывок выдаётся по уже выученным словам, второй раз не выдаётся', () => {
    const cafe = [...WORD_LEVELS.cafe[1], ...WORD_LEVELS.cafe[2]];
    useProgress.getState().hydrate({ cards: cafe.map(card), days: [], xpTotal: 0, grammar: [] });
    expect(currentJourney().chapters[0].places.find((p) => p.location === 'cafe')).toMatchObject({ ready: true });
    const got = useJourney.getState().sync(1000);
    expect(got).toEqual([{ kind: 'fragment', chapter: 1, location: 'cafe' }]);
    expect(useJourney.getState().fragments).toEqual({ '1:cafe': 1000 });
    expect(useJourney.getState().sync(2000)).toEqual([]);
    expect(currentJourney().chapters[0].fragments).toBe(1);
  });

  it('старые данные без пути открываются пустыми', () => {
    useProgress.getState().hydrate({ cards: [], days: [], xpTotal: 0, grammar: [] });
    expect(useJourney.getState()).toMatchObject({ fragments: {}, seals: {} });
    expect(currentJourney().current).toBe(1);
  });
});

describe('открытая глава', () => {
  const row = (lessonId: string) => ({ lessonId, completedAt: 1, bestScore: 100 });

  it('новый игрок: открыта глава I, после записи она сохраняется', () => {
    expect(useJourney.getState().opened).toBe(1);
    useJourney.getState().sync(1);
    expect(useJourney.getState().openedChapter).toBe(1);
  });

  it('перенос: пройденные уроки A2 открывают главу II, ничего не закрывается', () => {
    const a2 = lessonsOf('A2').slice(0, 3).map((l) => row(l.id));
    useProgress.getState().hydrate({ cards: [], days: [], xpTotal: 0, grammar: [row(lessonsOf('A1')[0].id), ...a2] });
    // Данные версии 2.6.0: путь есть, открытой главы нет.
    useJourney.getState().hydrate({ fragments: {}, seals: {} });
    expect(useJourney.getState().opened).toBe(2);
    useJourney.getState().sync(1);
    expect(useJourney.getState().openedChapter).toBe(2);
  });

  it('перенос: здание, прокачанное до уровня 5, открывает главу III', () => {
    useCity.getState().hydrate({ coins: 0, buildings: [{ locationId: 'cafe', level: 5, lastCollectedAt: 0 }] });
    useJourney.getState().hydrate(undefined);
    expect(useJourney.getState().opened).toBe(3);
  });

  it('записанная глава берётся как есть, без пересчёта', () => {
    useCity.getState().hydrate({ coins: 0, buildings: [{ locationId: 'cafe', level: 5, lastCollectedAt: 0 }] });
    useJourney.getState().hydrate({ fragments: {}, seals: {}, openedChapter: 1 });
    expect(useJourney.getState().opened).toBe(1);
  });
});

describe('сцена перехода', () => {
  it('отметка о показе сохраняется и не сбрасывается при выдаче обрывков', () => {
    useJourney.getState().hydrate({ fragments: {}, seals: {}, openedChapter: 1 });
    expect(useJourney.getState().celebrated).toBe(0);
    useJourney.getState().celebrate(1);
    useJourney.getState().celebrate(0);
    expect(useJourney.getState().celebrated).toBe(1);
    useJourney.getState().sync(5);
    expect(useJourney.getState().celebrated).toBe(1);
  });
});
