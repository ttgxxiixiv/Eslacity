import INDEX from 'virtual:grammar-index';
import { VARIANT, VARIANTS } from '../config';
import { forVariant } from '../domain/grammar';
import type { District, GrammarLesson } from './schema';

/** Краткие сведения об уроке для карты: сам урок грузится отдельно. */
export interface LessonMeta {
  id: string;
  district: District;
  order: number;
  title: string;
}

export const GRAMMAR: LessonMeta[] = INDEX.slice().sort((a, b) => a.order - b.order);

// Уроки лежат в отдельных чанках по районам и загружаются при открытии.
const loaders = import.meta.glob<GrammarLesson>('./grammar/*/*.json', { import: 'default' });
const loaderById = new Map<string, () => Promise<GrammarLesson>>();
for (const [path, load] of Object.entries(loaders)) {
  const [, folder, file] = path.match(/\/grammar\/([^/]+)\/(.+)\.json$/)!;
  loaderById.set(`${folder}.${file}`, load);
}

const cache = new Map<string, GrammarLesson>();

export async function loadLesson(id: string): Promise<GrammarLesson | undefined> {
  const hit = cache.get(id);
  if (hit) return hit;
  const load = loaderById.get(id);
  if (!load) return undefined;
  const lesson = forVariant(await load(), VARIANTS[VARIANT].vosotros);
  cache.set(id, lesson);
  return lesson;
}

export function hasLesson(id: string): boolean {
  return loaderById.has(id);
}

export const DISTRICTS: { id: District; title: string; subtitle: string }[] = [
  { id: 'A1', title: 'A1', subtitle: 'Первые шаги' },
  { id: 'A2', title: 'A2', subtitle: 'Прошедшие времена, местоимения, сравнения' },
  { id: 'B1.1', title: 'B1.1', subtitle: 'Будущее, условное наклонение, subjuntivo' },
  { id: 'B1.2', title: 'B1.2', subtitle: 'Условные предложения, косвенная речь, se' },
  { id: 'B2', title: 'B2', subtitle: 'Сложные времена subjuntivo, согласование времён' },
];

export function lessonsOf(d: District): LessonMeta[] {
  return GRAMMAR.filter((l) => l.district === d);
}
