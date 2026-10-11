import { useEffect, useMemo, useState } from 'react';
import { BOOK_FILE_CHAPTERS, loadBooks } from '../content/books';
import { loadThread } from '../content/scenes';
import type { BookFile, ThreadFile } from '../content/schema';
import { bookSlots, unreadBooks, type BookSlot } from '../domain/books';
import { noteDue, noteOf, threadDue } from '../domain/thread';
import { useBooks } from '../store/books';
import { useJourney } from '../store/journey';
import { useThread } from '../store/thread';

/*
 * Нить глав и книги Летописца для экранов и для главной (бейдж «Летопись»). Лежат отдельно от экранов: главная
 * грузится сразу, а экраны Летописи, книг и сцен — своими чанками (задача 16.2).
 */

export type Thread = Pick<ThreadFile, 'scenes' | 'notes'>;
let cached: Thread | null = null;

/** Нить глав из контента: файл маленький, грузится один раз. */
export function useThreadContent(): Thread | null {
  const [thread, setThread] = useState(cached);
  useEffect(() => {
    if (!cached) {
      loadThread().then((t) => {
        cached = t;
        setThread(t);
      });
    }
  }, []);
  return thread;
}

const cache = new Map<number, BookFile | null>();

/** Книги глав до открытой: файлы маленькие, грузятся один раз. */
function useBookFiles(opened: number): Map<number, BookFile> | null {
  const chapters = BOOK_FILE_CHAPTERS.filter((c) => c <= opened);
  const key = chapters.join(',');
  const [files, setFiles] = useState<Map<number, BookFile> | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(chapters.map(async (c) => [c, cache.has(c) ? cache.get(c)! : await loadBooks(c)] as const)).then((list) => {
      const m = new Map<number, BookFile>();
      for (const [c, f] of list) {
        cache.set(c, f);
        if (f) m.set(c, f);
      }
      if (alive) setFiles(m);
    });
    return () => {
      alive = false;
    };
    // Ключ — список глав: массив пересоздаётся на каждом рендере.
  }, [key]);
  return files;
}

/** Тексты по обрывкам: открытые и закрытые. Для Летописи и её бейджа. */
export function useBookSlots(): { slots: BookSlot[]; files: Map<number, BookFile> } | null {
  const opened = useJourney((s) => s.opened);
  const fragments = useJourney((s) => s.fragments);
  const files = useBookFiles(opened);
  return useMemo(() => {
    if (!files) return null;
    const ids = new Set([...files.values()].flatMap((f) => f.books.map((b) => b.id)));
    return { slots: bookSlots(opened, fragments, (id) => ids.has(id)), files };
  }, [files, opened, fragments]);
}

/** Что ждёт в Летописи: новые сцены нити и записка дня. Для кнопки на главной. */
export function useChronicleDue(now = Date.now()): { scenes: string[]; note: boolean; books: number } | null {
  const thread = useThreadContent();
  const opened = useJourney((s) => s.opened);
  const fragments = useJourney((s) => s.fragments);
  const rec = useThread((s) => s.rec);
  // Книги Летописца (задача 12.4): открытые и ещё не прочитанные.
  const bookData = useBookSlots();
  const booksRec = useBooks((s) => s.rec);
  return useMemo(() => {
    if (!thread || !bookData) return null;
    const ids = new Set(thread.scenes.map((s) => s.id));
    const note = noteDue(fragments, rec, now) && noteOf(thread.notes, opened, now) !== null;
    return { scenes: threadDue(opened, fragments, rec, (id) => ids.has(id)), note, books: unreadBooks(bookData.slots, booksRec).length };
  }, [thread, bookData, booksRec, opened, fragments, rec, now]);
}
