import { LANG } from '../lang';
import type { PrologueFile } from './schema';

// Пролог маленький и нужен при первом запуске: лежит в основном чанке.
const files = import.meta.glob<PrologueFile>('./*/prologue.json', { import: 'default', eager: true });

/** Пролог языка курса (задача 13.2). */
export const PROLOGUE: PrologueFile = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))![1];
