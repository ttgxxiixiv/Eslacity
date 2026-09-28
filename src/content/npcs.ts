import { SCROLL_PLACE } from '../domain/errands';
import { LANG } from '../lang';
import type { Chronicler, Guardian, GuardiansFile, LocationId, Npc, NpcsFile } from './schema';

// Жители обоих языков маленькие (по 20 записей), поэтому лежат в основном чанке.
const files = import.meta.glob<NpcsFile>('./*/npcs.json', { import: 'default', eager: true });

export const NPCS: Npc[] = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))?.[1].npcs ?? [];

export const NPC_BY_LOCATION = Object.fromEntries(NPCS.map((n) => [n.location, n])) as Partial<Record<LocationId, Npc>>;

export const NPC_BY_ID: Partial<Record<string, Npc>> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

const chroniclers = import.meta.glob<Chronicler>('./*/chronicler.json', { import: 'default', eager: true });

/** Летописец: житель без места, идёт рядом с героем по карте странствий. Его поручения — слова свитков. */
export const CHRONICLER: Chronicler = Object.entries(chroniclers).find(([path]) => path.startsWith(`./${LANG}/`))![1];


const guardianFiles = import.meta.glob<GuardiansFile>('./*/guardians.json', { import: 'default', eager: true });

/** Стражи земель по главам (задача 5.4): охраняют печати, у каждого языка свои имена и реплики. */
export const GUARDIANS: Guardian[] = Object.entries(guardianFiles).find(([path]) => path.startsWith(`./${LANG}/`))?.[1].guardians ?? [];

export const guardianOf = (chapter: number) => GUARDIANS.find((g) => g.chapter === chapter);

/** Кто говорит реплику сцены: `npc` — житель места, id — другой житель, `hero` — никто из жителей. */
export function speakerOf(who: string, place: string): Chronicler | undefined {
  return who === 'hero' ? undefined : who === 'npc' ? npcFor(place) : NPC_BY_ID[who];
}

/** Житель места или Летописец. */
export function npcFor(location: string): Chronicler | undefined {
  return location === SCROLL_PLACE ? CHRONICLER : NPC_BY_LOCATION[location as LocationId];
}
