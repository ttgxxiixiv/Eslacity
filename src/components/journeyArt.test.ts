import { describe, expect, it } from 'vitest';
import { cellOf, cellPolygon, COLS, MAP_H, MAP_W, ROWS } from './journeyArt';

const pts = (col: number, row: number) => cellPolygon(col, row).split(' ');

describe('обрывки карты', () => {
  it('20 обрывков, 5×4, места идут по строкам', () => {
    expect(COLS * ROWS).toBe(20);
    expect(cellOf(0)).toEqual({ col: 0, row: 0 });
    expect(cellOf(7)).toEqual({ col: 2, row: 1 });
    expect(cellOf(19)).toEqual({ col: 4, row: 3 });
  });

  it('соседи делят один и тот же рваный край, карта без щелей', () => {
    // Правый край (1,1) и левый край (2,1) — одни и те же точки.
    const a = new Set(pts(1, 1));
    const shared = pts(2, 1).filter((p) => a.has(p));
    expect(shared.length).toBeGreaterThanOrEqual(5);
    const b = new Set(pts(3, 2));
    expect(pts(3, 1).filter((p) => b.has(p)).length).toBeGreaterThanOrEqual(5);
  });

  it('внешний край ровный и лежит на границе карты, одинаково при каждом вызове', () => {
    const coords = pts(0, 0).map((p) => p.split(',').map(Number));
    expect(coords.some(([x, y]) => x === 0 && y === 0)).toBe(true);
    const last = pts(4, 3).map((p) => p.split(',').map(Number));
    expect(last.some(([x, y]) => x === MAP_W && y === MAP_H)).toBe(true);
    expect(cellPolygon(2, 2)).toBe(cellPolygon(2, 2));
  });
});
