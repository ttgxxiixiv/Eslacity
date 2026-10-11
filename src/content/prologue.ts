import { eager } from './registry';
import type { PrologueFile } from './schema';

// Пролог маленький и нужен при первом запуске: лежит в основном чанке.
/** Пролог языка курса (задача 13.2). */
export const PROLOGUE: PrologueFile = eager('prologue')!;
