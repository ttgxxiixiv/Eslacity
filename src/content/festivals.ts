import { loader } from './registry';
import { byHero } from '../store/settings';
import type { FestivalFile } from './schema';

// Праздники грузятся по одному и только выбранного языка (задача 10.5).

/** Файл праздника в роде путника: у путницы — женские формы (`fem`). */
export async function loadFestival(id: string): Promise<FestivalFile | undefined> {
  const load = loader('festivals', id);
  return load ? byHero(await load()) : undefined;
}
