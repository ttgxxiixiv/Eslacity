import Dexie, { type Table } from 'dexie';
import type { LocationId } from '../content/schema';
import type { SrsCard } from '../domain/srs';

export interface BuildingRow {
  locationId: LocationId;
  /** 0 = закрыто. */
  level: number;
  lastCollectedAt: number;
}

export interface GrammarRow {
  lessonId: string;
  completedAt: number;
  bestScore: number;
}

export interface DayRow {
  date: string;
  xp: number;
  newWords: number;
  reviews: number;
  lessons: number;
  grammarLessons: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class EslaDB extends Dexie {
  cards!: Table<SrsCard, string>;
  buildings!: Table<BuildingRow, string>;
  grammar!: Table<GrammarRow, string>;
  days!: Table<DayRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('eslacity');
    this.version(1).stores({
      cards: 'wordId, due',
      buildings: 'locationId',
      grammar: 'lessonId',
      days: 'date',
      meta: 'key',
    });
  }
}

export const db = new EslaDB();

export function emptyDay(date: string): DayRow {
  return { date, xp: 0, newWords: 0, reviews: 0, lessons: 0, grammarLessons: 0 };
}
