import { LANG } from '../lang';
import type { PairsFile } from './schema';

// Пары нужны только в Звоннице: грузятся отдельным чанком по языку.
const files = import.meta.glob<PairsFile>('./*/pairs.json', { import: 'default' });

/** Звонарь и минимальные пары текущего языка (задача 10.2). */
export function loadPairs(): Promise<PairsFile> {
  return files[`./${LANG}/pairs.json`]();
}
