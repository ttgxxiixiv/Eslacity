import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WORD_LEVELS } from '../content/wordIndex';
import type { SrsCard } from '../domain/srs';
import { currentJourney, useJourney } from './journey';
import { useProgress } from './progress';

const card = (wordId: string) => ({ wordId, ef: 2.5, interval: 1, reps: 1, due: 0, lapses: 0, learnedAt: 0, lastReviewedAt: 0 }) as SrsCard;

beforeEach(() => {
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
