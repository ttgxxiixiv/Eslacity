import { LANG } from '../lang';
import type { BookFile } from './schema';

// Книги Летописца (задача 12.4) грузятся по главам и только выбранного языка. `auto` достраивает сборка.
const modules = import.meta.glob<BookFile>('./*/books/*.json', { import: 'default' });

const loaders = new Map<number, () => Promise<BookFile>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, chapter] = path.match(/^\.\/([^/]+)\/books\/(\d+)\.json$/)!;
  if (lang === LANG) loaders.set(Number(chapter), load);
}

/** Главы, у которых есть книги в контенте. */
export const BOOK_FILE_CHAPTERS = [...loaders.keys()].sort((a, b) => a - b);

export async function loadBooks(chapter: number): Promise<BookFile | null> {
  const load = loaders.get(chapter);
  return load ? load() : null;
}
