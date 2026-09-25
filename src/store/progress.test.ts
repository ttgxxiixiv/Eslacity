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
