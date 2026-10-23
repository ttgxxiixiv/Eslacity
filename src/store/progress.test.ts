import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProgress } from './progress';

beforeEach(() => {
  useProgress.getState().hydrate({ cards: [], days: [], xpTotal: 90, grammar: [] });
  useProgress.getState().clearLevelUp();
});

describe('опыт и уровень', () => {
  it('отмечает переход на новый уровень', () => {
    useProgress.getState().addXp(5);
    expect(useProgress.getState().levelUp).toBeNull();
    useProgress.getState().addXp(5);
    expect(useProgress.getState().xpTotal).toBe(100);
    expect(useProgress.getState().levelUp).toBe(2);
  });

  it('поздравление можно убрать', () => {
    useProgress.getState().addXp(20);
    useProgress.getState().clearLevelUp();
    expect(useProgress.getState().levelUp).toBeNull();
  });
});

describe('запоминаемость и сверка с прогнозом (задача 21.2)', () => {
  it('плановый повтор пишет прогноз и ответ, новое слово — нет; смена режима пересчитывает сроки', async () => {
    const { useSettings } = await import('./settings');
    const t0 = new Date(2026, 0, 10, 15, 0).getTime();
    useProgress.getState().applyGrades({ 'cafe.te': 4, 'cafe.cafe': 4 }, t0);
    expect(useProgress.getState().calibration).toEqual([]);
    const card = useProgress.getState().cards['cafe.te'];
    const later = t0 + card.interval * 86_400_000;
    useProgress.getState().applyGrades({ 'cafe.te': 4, 'cafe.cafe': 1 }, later);
    const cal = useProgress.getState().calibration;
    expect(cal).toHaveLength(2);
    expect(cal.map(([, ok]) => ok)).toEqual([1, 0]);
    expect(cal[0][0]).toBeGreaterThan(800);

    const before = useProgress.getState().cards['cafe.te'].due;
    useSettings.getState().update({ retention: 'light' });
    expect(useProgress.getState().reschedule(0.85)).toBeGreaterThan(0);
    expect(useProgress.getState().cards['cafe.te'].due).toBeGreaterThan(before);
    useSettings.getState().update({ retention: 'normal' });
  });
});
