import { LANG } from '../lang';
import type { Rumor, RumorsFile } from './schema';

// Слухи города (задача 13.7) грузятся только для выбранного языка.
const files = import.meta.glob<RumorsFile>('./*/rumors.json', { import: 'default' });

export async function loadRumors(): Promise<Rumor[]> {
  const load = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))?.[1];
  return load ? (await load()).rumors : [];
}
