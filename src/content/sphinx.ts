import { byHero } from '../store/settings';
import { loader } from './registry';
import type { SphinxFile } from './schema';

// Сфинкс грузится только для выбранного языка и только у Врат Хранилища.
const load = loader('sphinx');

export async function loadSphinx(): Promise<SphinxFile | undefined> {
  // В роде путника (задача 20.2): монологи, тексты мудрости и реплики Хранилища с `fem`.
  return load ? byHero(await load()) : undefined;
}
