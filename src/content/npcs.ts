import { SCROLL_PLACE } from '../domain/errands';
import { LANG } from '../lang';
import type { Chronicler, LocationId, Npc, NpcsFile } from './schema';

// Жители обоих языков маленькие (по 20 записей), поэтому лежат в основном чанке.
const files = import.meta.glob<NpcsFile>('./*/npcs.json', { import: 'default', eager: true });

export const NPCS: Npc[] = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))?.[1].npcs ?? [];

export const NPC_BY_LOCATION = Object.fromEntries(NPCS.map((n) => [n.location, n])) as Partial<Record<LocationId, Npc>>;

const chroniclers = import.meta.glob<Chronicler>('./*/chronicler.json', { import: 'default', eager: true });

/** Летописец: житель без места, идёт рядом с героем по карте странствий. Его поручения — слова свитков. */
export const CHRONICLER: Chronicler = Object.entries(chroniclers).find(([path]) => path.startsWith(`./${LANG}/`))![1];


/** Житель места или Летописец. */
export function npcFor(location: string): Chronicler | undefined {
  return location === SCROLL_PLACE ? CHRONICLER : NPC_BY_LOCATION[location as LocationId];
}
