import { LANG } from '../lang';
import type { SphinxFile } from './schema';

// Сфинкс грузится только для выбранного языка и только у Врат Хранилища.
const modules = import.meta.glob<SphinxFile>('./*/sphinx.json', { import: 'default' });
const load = Object.entries(modules).find(([path]) => path.startsWith(`./${LANG}/`))?.[1];

export async function loadSphinx(): Promise<SphinxFile | undefined> {
  return load ? await load() : undefined;
}
