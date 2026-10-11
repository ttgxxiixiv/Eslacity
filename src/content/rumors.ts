import { loader } from './registry';
import type { Rumor } from './schema';

// Слухи города (задача 13.7) грузятся только для выбранного языка.

export async function loadRumors(): Promise<Rumor[]> {
  const load = loader('rumors');
  return load ? (await load()).rumors : [];
}
