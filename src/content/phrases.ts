import { LANG } from '../lang';
import { placeOfPhrase } from '../domain/itemId';
import type { LocationPhrases, Phrase } from './schema';

// Фразы мест грузятся по месту и только выбранного языка: в основной чанк не попадают.
const modules = import.meta.glob<LocationPhrases>('./*/phrases/*.json', { import: 'default' });

const loaderByPlace = new Map<string, () => Promise<LocationPhrases>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, place] = path.match(/^\.\/([^/]+)\/phrases\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderByPlace.set(place, load);
}

const cache = new Map<string, Phrase[]>();

export async function loadPhrases(place: string): Promise<Phrase[]> {
  const hit = cache.get(place);
  if (hit) return hit;
  const load = loaderByPlace.get(place);
  const list = load ? (await load()).phrases : [];
  cache.set(place, list);
  return list;
}

/** Фразы по id карточек (`ph:cafe.un-cafe`). Фразы, которых больше нет в контенте, пропускаются. */
export async function phrasesByIds(ids: string[]): Promise<Phrase[]> {
  const places = [...new Set(ids.map(placeOfPhrase))];
  const all = new Map((await Promise.all(places.map(loadPhrases))).flat().map((p) => [p.id, p]));
  return ids.map((id) => all.get(id)).filter((p): p is Phrase => !!p);
}
