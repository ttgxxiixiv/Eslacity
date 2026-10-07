import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { EMPTY_BOOKS, readBook, type BooksRecord } from '../domain/books';
import { useProgress } from './progress';

interface BooksState {
  rec: BooksRecord;
  hydrate(d: BooksRecord | undefined): void;
  /** Текст прочитан, `score` — сколько вопросов понято. Возвращает полученный опыт. */
  finish(id: string, score: number, now?: number): number;
}

/** Книги Летописца (задача 12.4): `meta.books` — прочитанные тексты и лучший результат вопросов. */
export const useBooks = create<BooksState>((set, get) => ({
  rec: EMPTY_BOOKS,
  hydrate(d) {
    set({ rec: { read: { ...d?.read } } });
  },
  finish(id, score, now = Date.now()) {
    const { rec, xp } = readBook(get().rec, id, score, now);
    set({ rec });
    persist(() => db.meta.put({ key: 'books', value: rec }));
    if (xp) useProgress.getState().addXp(xp);
    return xp;
  },
}));
