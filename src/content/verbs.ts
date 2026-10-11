import { loader } from './registry';
import type { VerbsFile } from './schema';

// Глаголы нужны только в кузнице: грузятся отдельным чанком по языку.

/** Кузнец и глаголы кузницы текущего языка (задача 5.5). */
export function loadVerbs(): Promise<VerbsFile> {
  return loader('verbs')!();
}
