import { loader } from './registry';
import type { PairsFile } from './schema';

// Пары нужны только в Звоннице: грузятся отдельным чанком по языку.

/** Звонарь и минимальные пары текущего языка (задача 10.2). */
export function loadPairs(): Promise<PairsFile> {
  return loader('pairs')!();
}
