import { loaders } from './registry';
import { byHero } from '../store/settings';
import type { LocationMissions, Mission } from './schema';

// Миссии грузятся по месту и только выбранного языка (реестр — registry.ts).
const loaderByPlace = new Map<string, () => Promise<LocationMissions>>(loaders('missions'));
// Праздники: миссия в файле праздника, «место» — fest-<id>.
for (const [id, load] of loaders('festivals'))
  loaderByPlace.set(`fest-${id}`, async () => ({ location: `fest-${id}`, missions: (await load()).missions }) as unknown as LocationMissions);

/** Место миссии: `ms:cafe.1` → `cafe`. */
export const placeOfMission = (id: string) => id.replace(/^ms:/, '').split('.')[0];

export async function loadMissions(place: string): Promise<Mission[]> {
  const load = loaderByPlace.get(place);
  // Реплики в роде путника: у путницы — женские формы (`fem`).
  return load ? byHero((await load()).missions) : [];
}

export async function loadMission(id: string): Promise<Mission | undefined> {
  return (await loadMissions(placeOfMission(id))).find((m) => m.id === id);
}
