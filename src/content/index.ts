import { loaders } from './registry';
import type { LocationId, Word, WordSource } from './schema';

// Слова всех языков лежат в src/content/<язык>/words; загружаются только слова выбранного языка.
// Файлы — из реестра контента (задача 16.5): src/content/registry.ts.




const loaderById = new Map<WordSource, () => Promise<{ words: Word[] }>>();
for (const [id, load] of loaders('words')) loaderById.set(id as LocationId, load);
// Свитки земель грузятся так же, как места: свиток главы I — «место» scroll1.
for (const [chapter, load] of loaders('scrolls')) loaderById.set(`scroll${Number(chapter)}`, load);
// Книги Летописца (задача 12.4): словарик текстов главы — «место» bk:<глава>.
for (const [chapter, load] of loaders('books')) loaderById.set(`bk:${Number(chapter)}`, load);
// Праздники (задача 10.5): слова праздника — «место» fest-<id>, файл общий со фразами и миссией.
for (const [id, load] of loaders('festivals')) loaderById.set(`fest-${id}`, load);

const cache = new Map<WordSource, Word[]>();
const byId = new Map<string, Word>();

function resolve(w: Word): Word {
  return w;
}

export function hasContent(id: WordSource): boolean {
  return loaderById.has(id);
}

export async function loadLocation(id: WordSource): Promise<Word[]> {
  const hit = cache.get(id);
  if (hit) return hit;
  const load = loaderById.get(id);
  if (!load) return [];
  const data = await load();
  const words = data.words.map(resolve);
  cache.set(id, words);
  for (const w of words) byId.set(w.id, w);
  return words;
}

export function cachedLocation(id: WordSource): Word[] | undefined {
  return cache.get(id);
}

export async function loadLocations(ids: Iterable<WordSource>): Promise<Word[]> {
  const lists = await Promise.all([...new Set(ids)].map(loadLocation));
  return lists.flat();
}

/** Место, свиток, праздник или книги главы: `cafe.te` → `cafe`, `scroll1.mapa` → `scroll1`, `fest-sanfermin.toro` → `fest-sanfermin`, `bk:1.vela` → `bk:1`. */
export function locationOfWord(wordId: string): WordSource {
  return wordId.split('.')[0] as WordSource;
}

/** Слова по id. Нужные локации подгружаются. Удалённые из контента слова пропускаются. */
export async function wordsByIds(ids: string[]): Promise<Word[]> {
  await loadLocations(ids.map(locationOfWord));
  return ids.map((id) => byId.get(id)).filter((w): w is Word => !!w);
}

export function wordById(id: string): Word | undefined {
  return byId.get(id);
}
