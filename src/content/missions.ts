import { LANG } from '../lang';
import type { LocationMissions, Mission } from './schema';

// Миссии грузятся по месту и только выбранного языка.
const modules = import.meta.glob<LocationMissions>('./*/missions/*.json', { import: 'default' });

const loaderByPlace = new Map<string, () => Promise<LocationMissions>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, place] = path.match(/^\.\/([^/]+)\/missions\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderByPlace.set(place, load);
}

/** Место миссии: `ms:cafe.1` → `cafe`. */
export const placeOfMission = (id: string) => id.replace(/^ms:/, '').split('.')[0];

export async function loadMissions(place: string): Promise<Mission[]> {
  const load = loaderByPlace.get(place);
  return load ? (await load()).missions : [];
}

export async function loadMission(id: string): Promise<Mission | undefined> {
  return (await loadMissions(placeOfMission(id))).find((m) => m.id === id);
}
