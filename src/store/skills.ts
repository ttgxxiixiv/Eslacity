import { useMemo } from 'react';
import type { SkillInput } from '../domain/skills';
import { useBooks } from './books';
import { useLetters } from './letters';
import { useMissions } from './missions';
import { useSphinx } from './sphinx';
import { useTrials } from './trials';

/** Доказательства умений «Что я умею» (задача 21.3) из хранилищ: миссии, стражи, письма, книги, Сфинкс. */
export function useSkillInput(): SkillInput {
  const missions = useMissions((s) => s.records);
  const trials = useTrials((s) => s.records);
  const entries = useLetters((s) => s.entries);
  const read = useBooks((s) => s.rec.read);
  const hear = useSphinx((s) => s.rec.rounds.hear);
  return useMemo(
    () => ({
      missionDone: (id) => missions[id]?.done !== undefined,
      guardianDone: (ch) => trials[`gd:${ch}`]?.done !== undefined,
      letterIds: entries.map((e) => e.letterId),
      booksRead: Object.keys(read),
      sphinxHear: hear !== undefined,
    }),
    [missions, trials, entries, read, hear],
  );
}
