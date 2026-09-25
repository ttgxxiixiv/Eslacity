import { describe, expect, it } from 'vitest';
import { H_ROADS, MAP_H, MAP_W, V_ROADS, door, labelCenter, pathLength, plotRect, route } from './townMap';

const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

describe('карта города', () => {
  it('участки лежат внутри картинки и не пересекают дороги', () => {
    for (let i = 0; i < 20; i++) {
      const r = plotRect(i);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(MAP_H);
      expect(r.x + r.w).toBeLessThanOrEqual(MAP_W);
      for (const x of V_ROADS) expect(x < r.x || x > r.x + r.w).toBe(true);
      for (const y of H_ROADS) expect(y < r.y || y > r.y + r.h).toBe(true);
      expect(inside(labelCenter(i), r)).toBe(true);
    }
  });

  it('у каждого здания своё место для героя, и оно на дороге', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const d = door(i);
      expect(V_ROADS).toContain(d.x);
      seen.add(`${d.x},${d.y}`);
    }
    expect(seen.size).toBe(20);
  });

  it('путь идёт только по дорогам', () => {
    for (const [a, b] of [[0, 19], [3, 16], [5, 6], [12, 2]]) {
      const r = route(a, b);
      expect(r[0]).toEqual(door(a));
      expect(r[r.length - 1]).toEqual(door(b));
      for (let k = 1; k < r.length; k++) {
        const [p, q] = [r[k - 1], r[k]];
        if (p.x === q.x) expect(V_ROADS).toContain(p.x);
        else {
          expect(p.y).toBe(q.y);
          expect(H_ROADS).toContain(p.y);
        }
      }
    }
  });

  it('по одной дороге герой идёт прямо, к тому же зданию путь нулевой', () => {
    expect(route(0, 4)).toHaveLength(2);
    expect(pathLength(route(5, 5))).toBe(0);
  });
});
