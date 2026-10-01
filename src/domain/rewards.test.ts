import { describe, expect, it } from 'vitest';
import { levelCost } from './heroLevel';
import { CLOAK_ORDER, EMPTY_REWARDS, grantUpTo, hintPrefix, normalizeRewards, rewardFor, rewardLines, spendHint, unlockLevel, type RewardsRecord } from './rewards';

describe('награды уровней героя', () => {
  it('таблица и жетоны на уровнях без другой награды', () => {
    expect(rewardFor(1)).toEqual({});
    expect(rewardFor(2)).toEqual({ hints: 3 });
    expect(rewardFor(3)).toEqual({ blitz: 'listen' });
    expect(rewardFor(4)).toEqual({ cloak: 'homespun' });
    expect(rewardFor(11)).toEqual({ hints: 5 });
    expect(rewardFor(26)).toEqual({ cloak: 'brocade' });
    expect(rewardFor(40)).toEqual({ hints: 5 });
  });

  it('накидки по материалам, от простой к благородной, и всё дороже по опыту; последняя — у конца пути', () => {
    const levels = CLOAK_ORDER.map((c) => unlockLevel({ cloak: c }));
    expect(levels).toEqual([1, 4, 9, 13, 17, 20, 23, 26]);
    // Опыт между соседними накидками растёт: каждая следующая дороже предыдущей.
    const xp = levels.map((l) => Array.from({ length: l - 1 }, (_, i) => levelCost(i + 1)).reduce((a, b) => a + b, 0));
    const gaps = xp.slice(1).map((x, i) => x - xp[i]);
    expect(gaps.every((g, i) => i === 0 || g > gaps[i - 1])).toBe(true);
    // Весь путь — примерно 135–215 тысяч опыта: парча приходит до самой нижней оценки конца.
    expect(xp.at(-1)).toBeLessThan(135_000);
    expect(xp.at(-1)).toBeGreaterThan(100_000);
  });

  it('задним числом выдаётся всё до текущего уровня, один раз', () => {
    const { rec, gained } = grantUpTo(EMPTY_REWARDS, 9);
    expect(gained.map((g) => g.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rec).toMatchObject({ level: 9, hints: 12, blitz: ['classic', 'listen', 'survival'], cloaks: ['sackcloth', 'homespun', 'linen'], cloak: 'sackcloth' });
    expect(grantUpTo(rec, 9).rec).toBe(rec);
    expect(grantUpTo(rec, 5).gained).toEqual([]);
    const later = grantUpTo(rec, 10);
    expect(later.gained).toEqual([{ level: 10, reward: { hints: 5 } }]);
    expect(later.rec.hints).toBe(17);
  });

  it('старые плащи цветов заменяются накидками по набранному уровню', () => {
    const old = { level: 7, hints: 4, blitz: ['classic', 'listen', 'survival'], cloaks: ['moss', 'crimson', 'indigo'], cloak: 'indigo' } as unknown as Partial<RewardsRecord>;
    const rec = normalizeRewards(old);
    expect(rec.cloaks).toEqual(['sackcloth', 'homespun']);
    expect(rec.cloak).toBe('homespun');
    expect(rec.hints).toBe(4);
    expect(normalizeRewards(undefined)).toEqual(EMPTY_REWARDS);
    expect(normalizeRewards({ ...EMPTY_REWARDS, level: 13, cloak: 'linen' }).cloak).toBe('linen');
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
    expect(rewardLines({ cloak: 'leather' })).toEqual(['накидка: кожа']);
    expect(rewardLines({ hints: 3 })).toEqual(['3 жетона подсказки']);
    expect(rewardLines({ hints: 5 })).toEqual(['5 жетонов подсказки']);
    expect(rewardLines({ blitz: 'listen' })).toEqual(['режим блица «На слух»']);
  });
});
