import { describe, expect, it } from 'vitest';
import { EMPTY_REWARDS, grantUpTo, hintPrefix, rewardFor, rewardLines, spendHint } from './rewards';

describe('награды уровней героя', () => {
  it('таблица и жетоны выше неё на чётных уровнях', () => {
    expect(rewardFor(1)).toEqual({});
    expect(rewardFor(3)).toEqual({ blitz: 'listen' });
    expect(rewardFor(16)).toEqual({ hints: 5 });
    expect(rewardFor(17)).toEqual({});
  });

  it('задним числом выдаётся всё до текущего уровня, один раз', () => {
    const { rec, gained } = grantUpTo(EMPTY_REWARDS, 7);
    expect(gained.map((g) => g.level)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(rec).toMatchObject({ level: 7, hints: 11, blitz: ['classic', 'listen', 'survival'], cloaks: ['moss', 'crimson', 'indigo'], cloak: 'moss' });
    expect(grantUpTo(rec, 7).rec).toBe(rec);
    expect(grantUpTo(rec, 5).gained).toEqual([]);
    const later = grantUpTo(rec, 8);
    expect(later.gained).toEqual([{ level: 8, reward: { hints: 5 } }]);
    expect(later.rec.hints).toBe(16);
  });

  it('жетон тратится, без жетонов запись та же', () => {
    expect(spendHint({ ...EMPTY_REWARDS, hints: 2 }).hints).toBe(1);
    expect(spendHint(EMPTY_REWARDS)).toBe(EMPTY_REWARDS);
  });

  it('подсказка — первая буква, у существительного с артиклем ещё и артикль', () => {
    const es = ['el', 'la', 'los', 'las'];
    const it = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'];
    expect(hintPrefix('la mesa', es)).toBe('la m');
    expect(hintPrefix('hablar', es)).toBe('h');
    expect(hintPrefix('dar una vuelta', es)).toBe('d');
    expect(hintPrefix("l'acqua", it)).toBe("l'a");
    expect(hintPrefix('gli amici', it)).toBe('gli a');
  });

  it('подписи наград', () => {
    expect(rewardLines({ cloak: 'crimson', hints: 3 })).toEqual(['3 жетона подсказки', 'плащ «Багрянец»']);
    expect(rewardLines({ hints: 5 })).toEqual(['5 жетонов подсказки']);
    expect(rewardLines({ blitz: 'listen' })).toEqual(['режим блица «На слух»']);
  });
});
