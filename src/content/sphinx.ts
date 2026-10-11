import { loader } from './registry';
import type { SphinxFile } from './schema';

// Сфинкс грузится только для выбранного языка и только у Врат Хранилища.
const load = loader('sphinx');

export async function loadSphinx(): Promise<SphinxFile | undefined> {
  return load ? await load() : undefined;
}
