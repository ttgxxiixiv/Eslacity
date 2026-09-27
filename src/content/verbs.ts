import { LANG } from '../lang';
import type { VerbsFile } from './schema';

// Глаголы нужны только в кузнице: грузятся отдельным чанком по языку.
const files = import.meta.glob<VerbsFile>('./*/verbs.json', { import: 'default' });

/** Кузнец и глаголы кузницы текущего языка (задача 5.5). */
export function loadVerbs(): Promise<VerbsFile> {
  return files[`./${LANG}/verbs.json`]();
}
