import { describe, expect, it } from 'vitest';
import { roadState } from './dailyRoad';

describe('дневной переход', () => {
  it('доля пути, горящие фонари и костёр', () => {
    expect(roadState(0, 100)).toEqual({ ratio: 0, lamps: [false, false, false, false], camp: false });
    expect(roadState(45, 100)).toEqual({ ratio: 0.45, lamps: [true, true, false, false], camp: false });
    expect(roadState(80, 100).lamps).toEqual([true, true, true, true]);
    expect(roadState(99, 100).camp).toBe(false);
    expect(roadState(100, 100)).toEqual({ ratio: 1, lamps: [true, true, true, true], camp: true });
    // Сверх цели путь не удлиняется.
    expect(roadState(250, 100).ratio).toBe(1);
    expect(roadState(10, 0).ratio).toBe(0);
  });
});
