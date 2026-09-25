import INDEX from 'virtual:grammar-index';
import { VARIANT, VARIANTS } from '../config';
import { LANG } from '../lang';
import { forVariant } from '../domain/grammar';
import type { District, GrammarLesson } from './schema';

/** Краткие сведения об уроке для карты: сам урок грузится отдельно. */
export interface LessonMeta {
  id: string;
  district: District;
  order: number;
  title: string;
}

export const GRAMMAR: LessonMeta[] = INDEX.filter((l) => l.lang === LANG).sort((a, b) => a.order - b.order);

// Уроки лежат в отдельных чанках по языкам и районам и загружаются при открытии.
const loaders = import.meta.glob<GrammarLesson>('./*/grammar/*/*.json', { import: 'default' });
const loaderById = new Map<string, () => Promise<GrammarLesson>>();
for (const [path, load] of Object.entries(loaders)) {
  const [, lang, folder, file] = path.match(/^\.\/([^/]+)\/grammar\/([^/]+)\/(.+)\.json$/)!;
  if (lang === LANG) loaderById.set(`${folder}.${file}`, load);
}

const cache = new Map<string, GrammarLesson>();

export async function loadLesson(id: string): Promise<GrammarLesson | undefined> {
  const hit = cache.get(id);
  if (hit) return hit;
  const load = loaderById.get(id);
  if (!load) return undefined;
  const lesson = forVariant(await load(), LANG !== 'es' || VARIANTS[VARIANT].vosotros);
  cache.set(id, lesson);
  return lesson;
}

export function hasLesson(id: string): boolean {
  return loaderById.has(id);
}

const SUBTITLES: Record<typeof LANG, Record<District, string>> = {
  es: {
    A1: 'Первые шаги',
    A2: 'Прошедшие времена, местоимения, сравнения',
    'B1.1': 'Будущее, условное наклонение, subjuntivo',
    'B1.2': 'Условные предложения, косвенная речь, se',
    B2: 'Сложные времена subjuntivo, согласование времён',
  },
  it: {
    A1: 'Первые шаги',
    A2: 'Passato prossimo, imperfetto, местоимения',
    'B1.1': 'Будущее, condizionale, congiuntivo',
    'B1.2': 'Условные предложения, косвенная речь, si',
    B2: 'Congiuntivo imperfetto и trapassato, согласование времён',
  },
};

export const DISTRICTS: { id: District; title: string; subtitle: string }[] = (
  ['A1', 'A2', 'B1.1', 'B1.2', 'B2'] as District[]
).map((id) => ({ id, title: id, subtitle: SUBTITLES[LANG][id] }));

export function lessonsOf(d: District): LessonMeta[] {
  return GRAMMAR.filter((l) => l.district === d);
}
