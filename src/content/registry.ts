import { LANG, type Lang } from '../lang';
import type {
  BookFile, Chronicler, DiaryFile, FestivalFile, GrammarLesson, GuardiansFile, LettersFile, LocationMissions, LocationPhrases,
  LocationScenes, LocationWords, NpcsFile, PairsFile, PrologueFile, RumorsFile, ScrollFile, SphinxFile, VerbsFile,
} from './schema';

/**
 * Реестр контента (задача 16.5): все файлы контента по видам. Загрузчики мест, уроков, сцен и остального берут
 * файлы отсюда, а не повторяют свой `import.meta.glob`. Новый вид контента или новый язык — строка здесь.
 *
 * Пути в `import.meta.glob` должны быть литералами (их разбирает Vite при сборке), поэтому по строке на вид.
 * Ленивые файлы — свой чанк на файл (уроки грамматики Vite собирает по районам, см. `vite.config.ts`).
 */
const LAZY = {
  words: import.meta.glob<LocationWords>('./*/words/*.json', { import: 'default' }),
  scrolls: import.meta.glob<ScrollFile>('./*/scrolls/*.json', { import: 'default' }),
  festivals: import.meta.glob<FestivalFile>('./*/festivals/*.json', { import: 'default' }),
  books: import.meta.glob<BookFile>('./*/books/*.json', { import: 'default' }),
  phrases: import.meta.glob<LocationPhrases>('./*/phrases/*.json', { import: 'default' }),
  missions: import.meta.glob<LocationMissions>('./*/missions/*.json', { import: 'default' }),
  scenes: import.meta.glob<LocationScenes>('./*/scenes/*.json', { import: 'default' }),
  grammar: import.meta.glob<GrammarLesson>('./*/grammar/*/*.json', { import: 'default' }),
  sphinx: import.meta.glob<SphinxFile>('./*/sphinx.json', { import: 'default' }),
  letters: import.meta.glob<LettersFile>('./*/letters.json', { import: 'default' }),
  rumors: import.meta.glob<RumorsFile>('./*/rumors.json', { import: 'default' }),
  verbs: import.meta.glob<VerbsFile>('./*/verbs.json', { import: 'default' }),
  pairs: import.meta.glob<PairsFile>('./*/pairs.json', { import: 'default' }),
};

/** Маленькие файлы, нужные сразу (жители, Летописец, стражи, дневник для медалей, пролог): в основном чанке. */
const EAGER = {
  npcs: import.meta.glob<NpcsFile>('./*/npcs.json', { import: 'default', eager: true }),
  chronicler: import.meta.glob<Chronicler>('./*/chronicler.json', { import: 'default', eager: true }),
  guardians: import.meta.glob<GuardiansFile>('./*/guardians.json', { import: 'default', eager: true }),
  diary: import.meta.glob<DiaryFile>('./*/diary.json', { import: 'default', eager: true }),
  prologue: import.meta.glob<PrologueFile>('./*/prologue.json', { import: 'default', eager: true }),
};

export type LazyKind = keyof typeof LAZY;
export type EagerKind = keyof typeof EAGER;
type LazyOf<K extends LazyKind> = (typeof LAZY)[K][string] extends () => Promise<infer T> ? T : never;
type EagerOf<K extends EagerKind> = (typeof EAGER)[K][string];
export type Loader<T> = () => Promise<T>;

/**
 * Язык и ключ файла по пути: `./es/words/cafe.json` → `es`, `cafe`; `./es/grammar/a1/02-ser.json` → `a1/02-ser`;
 * одиночный файл вида (`./es/sphinx.json`) — ключ ''.
 */
export function parseContentPath(path: string, kind: string): { lang: string; key: string } | null {
  const m = path.match(/^\.\/([^/]+)\/(.+)\.json$/);
  if (!m) return null;
  const [, lang, rest] = m;
  if (rest === kind) return { lang, key: '' };
  return rest.startsWith(`${kind}/`) ? { lang, key: rest.slice(kind.length + 1) } : null;
}

/** Загрузчики файлов вида на языке курса: ключ файла → загрузчик. */
export function loaders<K extends LazyKind>(kind: K, lang: Lang = LANG): Map<string, Loader<LazyOf<K>>> {
  const out = new Map<string, Loader<LazyOf<K>>>();
  for (const [path, load] of Object.entries(LAZY[kind])) {
    const p = parseContentPath(path, kind);
    if (p && p.lang === lang) out.set(p.key, load as Loader<LazyOf<K>>);
  }
  return out;
}

/** Загрузчик одного файла вида (по умолчанию одиночного: `sphinx.json`, `verbs.json`). */
export const loader = <K extends LazyKind>(kind: K, key = '', lang: Lang = LANG): Loader<LazyOf<K>> | undefined => loaders(kind, lang).get(key);

/** Файл вида, загруженный сразу, на языке курса. */
export function eager<K extends EagerKind>(kind: K, lang: Lang = LANG): EagerOf<K> | undefined {
  for (const [path, data] of Object.entries(EAGER[kind])) {
    const p = parseContentPath(path, kind);
    if (p && p.lang === lang) return data as EagerOf<K>;
  }
  return undefined;
}
