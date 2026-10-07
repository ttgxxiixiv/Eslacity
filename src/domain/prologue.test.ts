import { describe, expect, it } from 'vitest';
import { HOME_UNLOCK_WORDS, homeBlocks, legacyPrologue, prologuePending } from './prologue';

describe('пролог (задача 13.2)', () => {
  it('впереди, пока не пройден и не пропущен', () => {
    expect(prologuePending({})).toBe(true);
    expect(prologuePending({ done: 1 })).toBe(false);
    expect(prologuePending({ skipped: 1 })).toBe(false);
  });
  it('у тех, кто начал раньше, пролога нет и обрывка тоже', () => {
    expect(legacyPrologue(undefined, true, 5)).toEqual({ done: 5 });
    expect(legacyPrologue(undefined, false, 5)).toEqual({});
    expect(legacyPrologue({ skipped: 2 }, true, 5)).toEqual({ skipped: 2 });
  });
  it('главная открывается по мере игры', () => {
    expect(homeBlocks(0, 0, 0)).toEqual({ journey: false, review: false, grammar: false, blitz: false });
    expect(homeBlocks(3, 3, 0)).toEqual({ journey: true, review: true, grammar: false, blitz: false });
    expect(homeBlocks(0, 1, 1)).toEqual({ journey: true, review: true, grammar: true, blitz: false });
    expect(homeBlocks(HOME_UNLOCK_WORDS, 12, 0)).toEqual({ journey: true, review: true, grammar: true, blitz: true });
  });
});
