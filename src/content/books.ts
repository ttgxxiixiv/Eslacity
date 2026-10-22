import { byHero } from '../store/settings';
import { loaders as contentLoaders } from './registry';
import type { BookFile } from './schema';

// Книги Летописца (задача 12.4) грузятся по главам и только выбранного языка (реестр — registry.ts). `auto` достраивает сборка.
const loaders = new Map<number, () => Promise<BookFile>>([...contentLoaders('books')].map(([chapter, load]) => [Number(chapter), load]));

/** Главы, у которых есть книги в контенте. */
export const BOOK_FILE_CHAPTERS = [...loaders.keys()].sort((a, b) => a - b);

export async function loadBooks(chapter: number): Promise<BookFile | null> {
  const load = loaders.get(chapter);
  return load ? byHero(await load()) : null;
}
