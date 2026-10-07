import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sfx', () => ({ playSfx: vi.fn() }));
const { playSfx } = await import('./sfx');
const { watchSoundCues } = await import('./cues');
const { useCity } = await import('../store/city');
const { useJourney } = await import('../store/journey');
const { useProgress } = await import('../store/progress');

describe('звуки наград (задача 13.3)', () => {
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    useProgress.setState({ xpTotal: 0 });
    useCity.setState({ coins: 0 });
    useJourney.setState({ fragments: {}, seals: {} });
    vi.mocked(playSfx).mockClear();
    off = watchSoundCues();
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  it('монеты — звон монет', () => {
    useCity.setState({ coins: 10 });
    vi.advanceTimersByTime(100);
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('coins');
  });
  it('монеты, обрывок и новый уровень разом — один звук, самый важный', () => {
    useCity.setState({ coins: 10 });
    useJourney.setState({ fragments: { '1:cafe': 1 } });
    useProgress.setState({ xpTotal: 100_000 });
    vi.advanceTimersByTime(100);
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('level');
  });
  it('печать важнее обрывка; трата монет звука не даёт', () => {
    useJourney.setState({ fragments: { '1:cafe': 1 }, seals: { '1': 1 } });
    vi.advanceTimersByTime(100);
    expect(playSfx).toHaveBeenCalledExactlyOnceWith('seal');
    vi.mocked(playSfx).mockClear();
    useCity.setState({ coins: 0 });
    vi.advanceTimersByTime(100);
    expect(playSfx).not.toHaveBeenCalled();
  });
});
