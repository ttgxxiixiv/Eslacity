import { loaders } from './registry';
import { byHero } from '../store/settings';
import { isThreadId, THREAD_PLACE } from '../domain/thread';
import type { Scene, ThreadFile } from './schema';

// Сцены грузятся по месту и только выбранного языка (реестр — registry.ts). `auto` (переводы слов) достраивает сборка.
const loaderByPlace = loaders('scenes');

/** Место сцены: `sc:cafe.1` → `cafe`, шёпота: `wh:cafe.4` → `cafe`, нити главы: `th:1.open` → `thread`. */
export const placeOfScene = (id: string) => (isThreadId(id) ? THREAD_PLACE : id.replace(/^(sc|wh):/, '').split('.')[0]);

export async function loadScenes(place: string): Promise<Scene[]> {
  const load = loaderByPlace.get(place);
  // Реплики в роде путника: у путницы — женские формы (`fem`).
  return load ? byHero((await load()).scenes) : [];
}

export async function loadScene(id: string): Promise<Scene | undefined> {
  return (await loadScenes(placeOfScene(id))).find((s) => s.id === id);
}

/** Нить глав (задача 13.1): сцены Летописца и записки конца дня, в роде путника. */
export async function loadThread(): Promise<Pick<ThreadFile, 'scenes' | 'notes'>> {
  const load = loaderByPlace.get(THREAD_PLACE);
  const data = load ? ((await load()) as unknown as ThreadFile) : { scenes: [], notes: {} };
  return { scenes: byHero(data.scenes), notes: byHero(data.notes ?? {}) };
}
