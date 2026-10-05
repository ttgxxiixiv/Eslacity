import { describe, expect, it } from 'vitest';
import { bestTier, DECOR, decorSpot, lanternOf, shownDecor, unlockedDecor, unlockedLanterns } from './decor';
import { ACTIVE_LINES, type MedalsState } from './medals';
import { H_ROADS, V_ROADS } from './townMap';

const medals = (lines: MedalsState['lines']): MedalsState => ({ lines, secrets: {} });

describe('украшения города', () => {
  it('у каждой линии медалей своё украшение на своём перекрёстке', () => {
    expect(DECOR.map((d) => d.line).sort()).toEqual(ACTIVE_LINES.map((l) => l.id).sort());
    const spots = new Set(DECOR.map((d) => `${d.at[0]}.${d.at[1]}`));
    expect(spots.size).toBe(V_ROADS.length * H_ROADS.length);
    expect(decorSpot(DECOR[0])).toEqual({ x: V_ROADS[0], y: H_ROADS[0] });
  });

  it('украшение ставит золотая медаль линии и выше', () => {
    const m = medals({ words: { wood: 1, stone: 2, bronze: 3, silver: 4 }, streak: { wood: 1, stone: 2, bronze: 3, silver: 4, gold: 5 }, echo: { wood: 1, gold: 2, diamond: 3 } });
    expect(unlockedDecor(m).map((d) => d.line).sort()).toEqual(['echo', 'streak']);
    // Убранное игроком на карте не стоит, но остаётся открытым.
    expect(shownDecor(m, ['streak']).map((d) => d.line)).toEqual(['echo']);
  });
});

describe('фонарь путника', () => {
  it('лучшая медаль открывает фонари до её достоинства', () => {
    expect(bestTier(medals({}))).toBeNull();
    expect(unlockedLanterns(medals({})).map((l) => l.id)).toEqual(['amber']);
    const m = medals({ words: { wood: 1, stone: 2, bronze: 3 }, grammar: { wood: 1, stone: 2, bronze: 3, silver: 4 } });
    expect(bestTier(m)).toBe('silver');
    expect(unlockedLanterns(m).map((l) => l.id)).toEqual(['amber', 'bronze', 'silver']);
  });

  it('выбранный, но ещё закрытый фонарь заменяется обычным', () => {
    const m = medals({ words: { bronze: 1 } });
    expect(lanternOf(m, 'bronze').id).toBe('bronze');
    expect(lanternOf(m, 'gold').id).toBe('amber');
    expect(lanternOf(m, undefined).id).toBe('amber');
  });
});
