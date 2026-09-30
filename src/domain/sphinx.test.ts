import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SphinxFile } from '../content/schema';
import { seeded } from './generators';
import {
  arrive, EMPTY_SPHINX, finishRound, nextRound, roundPassed, setIndex, SPHINX_HEARTS, SPHINX_WAIT_MS, sphinxStatus,
  sphinxItems, sphinxWaitLabel, type SphinxRecord,
} from './sphinx';

const T = 1_000_000;

describe('Сфинкс', () => {
  it('раунды идут по порядку: слух, слово, мудрость', () => {
    expect(nextRound(EMPTY_SPHINX)).toBe('hear');
    expect(nextRound({ ...EMPTY_SPHINX, rounds: { hear: T } })).toBe('word');
    expect(nextRound({ ...EMPTY_SPHINX, rounds: { hear: T, word: T } })).toBe('wisdom');
    expect(nextRound({ ...EMPTY_SPHINX, rounds: { hear: T, word: T, wisdom: T } })).toBeNull();
  });

  it('порог 80%, «почти» считается верным на стороне вызывающего', () => {
    expect(roundPassed(8, 10)).toBe(true);
    expect(roundPassed(7, 10)).toBe(false);
    expect(roundPassed(4, 5)).toBe(true);
    expect(roundPassed(0, 0)).toBe(false);
  });

  it('проваленный раунд стоит сердце и идёт по следующему набору', () => {
    const { rec, passed, exhausted } = finishRound(EMPTY_SPHINX, 'hear', 5, 10, T);
    expect(passed).toBe(false);
    expect(exhausted).toBe(false);
    expect(rec.hearts).toBe(SPHINX_HEARTS - 1);
    expect(setIndex(EMPTY_SPHINX, 'hear')).toBe(0);
    expect(setIndex(rec, 'hear')).toBe(1);
    expect(setIndex(rec, 'word')).toBe(0);
    expect(nextRound(rec)).toBe('hear');
  });

  it('пройденный раунд сердце не тратит и не отнимается', () => {
    const a = finishRound(EMPTY_SPHINX, 'hear', 9, 10, T).rec;
    expect(a.hearts).toBe(SPHINX_HEARTS);
    expect(a.rounds.hear).toBe(T);
    const b = finishRound({ ...a, hearts: 1 }, 'word', 1, 10, T + 1).rec;
    expect(b.rounds.hear).toBe(T);
    expect(nextRound(b)).toBe('word');
  });

  it('сердца кончились — ожидание три дня, потом полные сердца и другой набор', () => {
    let r: SphinxRecord = EMPTY_SPHINX;
    for (let i = 0; i < 2; i++) r = finishRound(r, 'hear', 0, 8, T).rec;
    const last = finishRound(r, 'hear', 0, 8, T);
    expect(last.exhausted).toBe(true);
    expect(last.rec.hearts).toBe(0);
    expect(last.rec.waitUntil).toBe(T + SPHINX_WAIT_MS);
    expect(sphinxStatus(last.rec, T + SPHINX_WAIT_MS - 1)).toBe('waiting');
    expect(sphinxStatus(last.rec, T + SPHINX_WAIT_MS)).toBe('open');
    // Ожидание не прошло — сердца не возвращаются.
    expect(arrive(last.rec, T + 1).hearts).toBe(0);
    const back = arrive(last.rec, T + SPHINX_WAIT_MS);
    expect(back.hearts).toBe(SPHINX_HEARTS);
    expect(back.waitUntil).toBeUndefined();
    // Три попытки по трём наборам, четвёртая снова по первому, но уже через три дня.
    expect(setIndex(back, 'hear')).toBe(0);
    expect(setIndex(finishRound(back, 'hear', 0, 8, T).rec, 'hear')).toBe(1);
  });

  it('первый приход отмечается один раз', () => {
    const a = arrive(EMPTY_SPHINX, T);
    expect(a.visited).toBe(T);
    expect(arrive(a, T + 5).visited).toBe(T);
  });

  it('третий пройденный раунд — победа, Врата открыты навсегда', () => {
    let r: SphinxRecord = { ...EMPTY_SPHINX, rounds: { hear: T, word: T } };
    const res = finishRound(r, 'wisdom', 5, 6, T + 9);
    expect(res.victory).toBe(true);
    expect(res.rec.done).toBe(T + 9);
    expect(sphinxStatus(res.rec, T + 10)).toBe('done');
    r = res.rec;
    expect(finishRound(r, 'wisdom', 6, 6, T + 20).victory).toBe(false);
  });

  it('подпись ожидания', () => {
    expect(sphinxWaitLabel(T + SPHINX_WAIT_MS, T)).toBe('через 3 дн');
    expect(sphinxWaitLabel(T + 5 * 3_600_000, T)).toBe('через 5 ч');
    expect(sphinxWaitLabel(T + 26 * 3_600_000, T)).toBe('через 1 дн 2 ч');
  });
});

describe.each(['es', 'it'])('задания раундов: %s', (lang) => {
  const file = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', lang, 'sphinx.json'), 'utf8')) as SphinxFile;
  it('слух: восемь вопросов, сначала к монологу, верный вариант на месте', () => {
    for (let set = 0; set < 3; set++) {
      const items = sphinxItems(file, 'hear', set, seeded(set + 1));
      expect(items).toHaveLength(8);
      items.forEach((it, k) => {
        if (it.kind !== 'question') throw new Error('не вопрос');
        const q = [...file.hear[set].questions].sort((a, b) => Number(a.part === 'dispute') - Number(b.part === 'dispute'))[k];
        expect(it.q).toBe(q.q);
        expect(it.options[it.answer]).toBe(q.options[q.answer]);
      });
    }
  });
  it('слово: десять заданий набора; мудрость: пять вопросов и два ответа в разном тоне', () => {
    const word = sphinxItems(file, 'word', 1, seeded(3));
    expect(word.map((it) => (it.kind === 'grammar' ? it.item.ex.id : ''))).toEqual(file.word[1].exercises.map((e) => e.id));
    const wisdom = sphinxItems(file, 'wisdom', 2, seeded(4));
    expect(wisdom.map((it) => it.kind)).toEqual(['question', 'question', 'question', 'question', 'question', 'grammar', 'grammar']);
    expect(wisdom.flatMap((it) => (it.kind === 'grammar' && it.item.ex.kind === 'register' ? [it.item.ex.to] : []))).toEqual(['formal', 'informal']);
  });
  it('у Сфинкса есть все реплики', () => {
    expect(Object.keys(file.sphinx.speech)).toHaveLength(10);
  });
});
