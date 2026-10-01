import { LANG } from '../lang';
import { byHero } from '../store/settings';
import type { LocationScenes, Scene } from './schema';

// Сцены грузятся по месту и только выбранного языка. `auto` (переводы слов) достраивает сборка.
const modules = import.meta.glob<LocationScenes>('./*/scenes/*.json', { import: 'default' });

const loaderByPlace = new Map<string, () => Promise<LocationScenes>>();
for (const [path, load] of Object.entries(modules)) {
  const [, lang, place] = path.match(/^\.\/([^/]+)\/scenes\/([^/]+)\.json$/)!;
  if (lang === LANG) loaderByPlace.set(place, load);
}

/** Место сцены: `sc:cafe.1` → `cafe`, шёпота: `wh:cafe.4` → `cafe`. */
export const placeOfScene = (id: string) => id.replace(/^(sc|wh):/, '').split('.')[0];

export async function loadScenes(place: string): Promise<Scene[]> {
  const load = loaderByPlace.get(place);
  // Реплики в роде путника: у путницы — женские формы (`fem`).
  return load ? byHero((await load()).scenes) : [];
}

export async function loadScene(id: string): Promise<Scene | undefined> {
  return (await loadScenes(placeOfScene(id))).find((s) => s.id === id);
}
