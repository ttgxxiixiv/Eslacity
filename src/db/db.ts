import Dexie, { type Table } from 'dexie';
import type { LocationId } from '../content/schema';
import type { SrsCard } from '../domain/srs';
import type { AnswerRecord } from '../domain/answerLog';
import { L } from '../lang';

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
  goalMet?: boolean;
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
  answers!: Table<AnswerRecord, number>;

  constructor() {
    // У каждого языка своя база: у испанского прежнее имя, чтобы прогресс сохранился.
    super(L.db);
    this.version(1).stores({
      cards: 'wordId, due',
      buildings: 'locationId',
      grammar: 'lessonId',
      days: 'date',
      meta: 'key',
    });
    // Версия 2: журнал ответов. Остальные таблицы не меняются, переносить нечего.
    this.version(2).stores({
      answers: '++id, ts, itemId, mode',
    });
  }
}

export const db = new EslaDB();

export function emptyDay(date: string): DayRow {
  return { date, xp: 0, newWords: 0, reviews: 0, lessons: 0, grammarLessons: 0 };
}
