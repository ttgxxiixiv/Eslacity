import { LANG } from '../lang';
import type { LocationId, Npc, NpcsFile } from './schema';

// Жители обоих языков маленькие (по 20 записей), поэтому лежат в основном чанке.
const files = import.meta.glob<NpcsFile>('./*/npcs.json', { import: 'default', eager: true });

export const NPCS: Npc[] = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))?.[1].npcs ?? [];

export const NPC_BY_LOCATION = Object.fromEntries(NPCS.map((n) => [n.location, n])) as Partial<Record<LocationId, Npc>>;
