import { eager } from './registry';
import type { DiaryEntry } from './schema';

// Дневник путника (задача 13.8): записей немного, они нужны и медалям, поэтому грузятся сразу.
export const DIARY: DiaryEntry[] = eager('diary')?.entries ?? [];
