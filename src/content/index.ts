import { VARIANT } from '../config';
import { LANG } from '../lang';
import type { LocationId, LocationWords, Word } from './schema';

// Слова всех языков лежат в src/content/<язык>/words; загружаются только слова выбранного языка.
const modules = import.meta.glob<LocationWords>('./*/words/*.json', { import: 'default' });

const loaderById = new Map<LocationId, () => Promise<LocationWords>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, id] = path.match(/^\.\/([^/]+)\/words\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderById.set(id as LocationId, load);
}

const cache = new Map<LocationId, Word[]>();
const byId = new Map<string, Word>();

function resolve(w: Word): Word {
  if (LANG === 'es' && VARIANT === 'es-419' && w.latam) return { ...w, es: w.latam, alt: undefined };
  return w;
}

export function hasContent(id: LocationId): boolean {
  return loaderById.has(id);
}

export function contentLocations(): LocationId[] {
  return [...loaderById.keys()];
}

export async function loadLocation(id: LocationId): Promise<Word[]> {
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

export function cachedLocation(id: LocationId): Word[] | undefined {
  return cache.get(id);
}

export async function loadLocations(ids: Iterable<LocationId>): Promise<Word[]> {
  const lists = await Promise.all([...new Set(ids)].map(loadLocation));
  return lists.flat();
}

export function locationOfWord(wordId: string): LocationId {
  return wordId.split('.')[0] as LocationId;
}

/** Слова по id. Нужные локации подгружаются. Удалённые из контента слова пропускаются. */
export async function wordsByIds(ids: string[]): Promise<Word[]> {
  await loadLocations(ids.map(locationOfWord));
  return ids.map((id) => byId.get(id)).filter((w): w is Word => !!w);
}

export function wordById(id: string): Word | undefined {
  return byId.get(id);
}
