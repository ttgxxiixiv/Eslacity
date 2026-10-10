import { LANG } from '../lang';
import type { DiaryEntry, DiaryFile } from './schema';

// Дневник путника (задача 13.8): записей немного, они нужны и медалям, поэтому грузятся сразу.
const files = import.meta.glob<DiaryFile>('./*/diary.json', { import: 'default', eager: true });

export const DIARY: DiaryEntry[] = Object.entries(files).find(([path]) => path.startsWith(`./${LANG}/`))?.[1].entries ?? [];
