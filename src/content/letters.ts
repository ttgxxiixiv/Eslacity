import { LANG } from '../lang';
import type { Letter, LettersFile, Note } from './schema';

// Письма грузятся только для выбранного языка и только когда нужны: в месте, на экране письма, в дневнике.
const modules = import.meta.glob<LettersFile>('./*/letters.json', { import: 'default' });
const load = Object.entries(modules).find(([path]) => path.startsWith(`./${LANG}/`))?.[1];

export async function loadLetters(): Promise<Letter[]> {
  return load ? (await load()).letters : [];
}

export async function loadLetter(id: string): Promise<Letter | undefined> {
  return (await loadLetters()).find((l) => l.id === id);
}

export async function loadNotes(): Promise<Note[]> {
  return load ? ((await load()).notes ?? []) : [];
}

export async function loadNote(id: string): Promise<Note | undefined> {
  return (await loadNotes()).find((n) => n.id === id);
}
