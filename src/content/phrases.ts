import { LANG } from '../lang';
import { byHero } from '../store/settings';
import { placeOfPhrase } from '../domain/itemId';
import type { FestivalFile, LocationPhrases, Phrase } from './schema';

// Фразы мест грузятся по месту и только выбранного языка: в основной чанк не попадают.
const modules = import.meta.glob<LocationPhrases>('./*/phrases/*.json', { import: 'default' });

const loaderByPlace = new Map<string, () => Promise<LocationPhrases>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, place] = path.match(/^\.\/([^/]+)\/phrases\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderByPlace.set(place, load);
}
// Праздники: фразы в файле праздника, «место» — fest-<id>.
const festivals = import.meta.glob<FestivalFile>('./*/festivals/*.json', { import: 'default' });
for (const [path, load] of Object.entries(festivals)) {
  const [, lang, id] = path.match(/^\.\/([^/]+)\/festivals\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderByPlace.set(`fest-${id}`, async () => ({ location: `fest-${id}`, phrases: (await load()).phrases }) as unknown as LocationPhrases);
}

const cache = new Map<string, Phrase[]>();

/** Фразы места в роде путника: у путницы — женские формы (`fem`). */
export async function loadPhrases(place: string): Promise<Phrase[]> {
  let list = cache.get(place);
  if (!list) {
    const load = loaderByPlace.get(place);
    list = load ? (await load()).phrases : [];
    cache.set(place, list);
  }
  return byHero(list);
}

/** Фразы по id карточек (`ph:cafe.un-cafe`). Фразы, которых больше нет в контенте, пропускаются. */
export async function phrasesByIds(ids: string[]): Promise<Phrase[]> {
  const places = [...new Set(ids.map(placeOfPhrase))];
  const all = new Map((await Promise.all(places.map(loadPhrases))).flat().map((p) => [p.id, p]));
  return ids.map((id) => all.get(id)).filter((p): p is Phrase => !!p);
}
