import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { drinkElixir } from '../domain/elixir';
import { arrive, EMPTY_SPHINX, finishRound, type RoundResult, type SphinxRecord, type SphinxRound } from '../domain/sphinx';

interface SphinxState {
  rec: SphinxRecord;
  hydrate(d: Partial<SphinxRecord> | undefined): void;
  /** Герой подошёл к Вратам: отметка первого прихода, после ожидания — полные сердца. */
  arrive(now?: number): void;
  finish(round: SphinxRound, good: number, total: number, now?: number): RoundResult;
  /** Выпить Эликсир в Хранилище. Возвращает true, если это случилось сейчас. */
  drink(now?: number): boolean;
}

export const useSphinx = create<SphinxState>((set, get) => {
  const save = (rec: SphinxRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'sphinx', value: rec }));
  };
  return {
    rec: EMPTY_SPHINX,

    hydrate(d) {
      set({ rec: { ...EMPTY_SPHINX, ...d, rounds: { ...d?.rounds }, attempts: { ...d?.attempts } } });
    },

    arrive(now = Date.now()) {
      const rec = arrive(get().rec, now);
      if (rec !== get().rec) save(rec);
    },

    drink(now = Date.now()) {
      const rec = drinkElixir(get().rec, now);
      if (rec === get().rec) return false;
      save(rec);
      return true;
    },

    finish(round, good, total, now = Date.now()) {
      const res = finishRound(get().rec, round, good, total, now);
      save(res.rec);
      return res;
    },
  };
});
