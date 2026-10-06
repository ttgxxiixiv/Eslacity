import { LANG } from '../lang';
import { byHero } from '../store/settings';
import type { FestivalFile } from './schema';

// Праздники грузятся по одному и только выбранного языка (задача 10.5).
const modules = import.meta.glob<FestivalFile>('./*/festivals/*.json', { import: 'default' });

/** Файл праздника в роде путника: у путницы — женские формы (`fem`). */
export async function loadFestival(id: string): Promise<FestivalFile | undefined> {
  const load = modules[`./${LANG}/festivals/${id}.json`];
  return load ? byHero(await load()) : undefined;
}
