import { describe, expect, it } from 'vitest';
import { COLS, PLOT, ROAD, door, mapHeight, pathLength, roadX, route } from './townMap';

describe('карта города', () => {
  it('участки и дороги занимают всю ширину', () => {
    expect(COLS * PLOT + (COLS + 1) * ROAD).toBeCloseTo(100);
    expect(mapHeight(5)).toBeCloseTo(ROAD + 5 * (PLOT + ROAD));
  });

  it('в своём ряду герой идёт по прямой', () => {
    const r = route(0, 3);
    expect(r).toHaveLength(2);
    expect(r[0].y).toBe(r[1].y);
  });

  it('между рядами путь идёт по вертикальной дороге', () => {
    const r = route(0, 9);
    expect(r).toHaveLength(3);
    expect(r[1].x).toBe(r[2].x);
    expect([0, 1, 2, 3, 4].map(roadX)).toContain(r[1].x);
    // Все отрезки горизонтальные или вертикальные.
    for (let k = 1; k < r.length; k++) expect(r[k].x === r[k - 1].x || r[k].y === r[k - 1].y).toBe(true);
    expect(r[0]).toEqual(door(0));
    expect(r[2]).toEqual(door(9));
  });

  it('герой стоит на перекрёстке дорог', () => {
    const d = door(6);
    expect([0, 1, 2, 3, 4].map(roadX)).toContain(d.x);
  });

  it('к тому же зданию путь нулевой', () => {
    expect(pathLength(route(5, 5))).toBe(0);
  });
});
