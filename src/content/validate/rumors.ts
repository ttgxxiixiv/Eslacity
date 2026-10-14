import { normalize } from '../../domain/answer';
import { CHAPTERS } from '../../domain/chapters';
import { type Issue, empty, textKeys } from './common';

/** Слухи города. */

/** Слухов на главу (задача 13.7). */
export const RUMORS_PER_CHAPTER = 4;

/** Доля незнакомых слов в слухе: он короткий, одно имя собственное уже 8%. */
export const RUMOR_UNKNOWN_MAX = 0.15;

/**
 * Слухи города (задача 13.7): id `rm:<глава>.<n>`, говорит житель или Летописец, реплика и перевод, на каждую главу
 * не меньше `RUMORS_PER_CHAPTER`. Незнакомые к уровню главы слова — в `gloss`, их не больше `RUMOR_UNKNOWN_MAX`.
 */
export function validateRumors(
  file: { rumors?: { id: string; chapter: number; who: string; es: string; ru: string; gloss?: Record<string, string> }[] } | undefined,
  speakers: ReadonlySet<string>,
  coverage?: (text: string, level: number) => { total: number; unknown: string[] },
): Issue[] {
  const out: Issue[] = [];
  const at = 'rumors.json';
  if (!file) return [{ level: 'error', where: at, msg: 'нет файла слухов' }];
  const ids = new Set<string>();
  for (const r of file.rumors ?? []) {
    const where = `${at} ${r.id}`;
    const err = (msg: string) => out.push({ level: 'error', where, msg });
    if (!/^rm:[1-5]\.\d+$/.test(r.id) || r.id.split(':')[1].split('.')[0] !== String(r.chapter)) err('id должен быть rm:<глава>.<n>');
    if (ids.has(r.id)) err('дубль id');
    ids.add(r.id);
    if (!speakers.has(r.who)) err(`неизвестный житель "${r.who}"`);
    if (empty(r.es) || empty(r.ru)) err('нет реплики или перевода');
    else if (!/\p{Script=Latin}/u.test(r.es) || /\p{Script=Cyrillic}/u.test(r.es)) err('реплика не на изучаемом языке');
    const gloss = Object.fromEntries(Object.entries(r.gloss ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const keys = new Set(textKeys(r.es ?? ''));
    for (const [k, v] of Object.entries(gloss)) {
      if (empty(v)) err(`пустой перевод в gloss: "${k}"`);
      if (!keys.has(normalize(k))) out.push({ level: 'warning', where, msg: `слова "${k}" из gloss нет в реплике` });
    }
    const level = CHAPTERS[r.chapter - 1]?.levels.at(-1);
    if (coverage && level && !empty(r.es)) {
      const c = coverage(r.es, level);
      const unknown = [...new Set(c.unknown)];
      if (c.unknown.length > Math.max(1, Math.floor(c.total * RUMOR_UNKNOWN_MAX))) err(`незнакомых слов к главе ${r.chapter}: ${unknown.join(', ')}`);
      const bare = unknown.filter((t) => !gloss[t]);
      if (bare.length) out.push({ level: 'warning', where, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
    }
  }
  for (const ch of [1, 2, 3, 4, 5]) {
    const n = (file.rumors ?? []).filter((r) => r.chapter === ch).length;
    if (n < RUMORS_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `слухов главы ${ch}: ${n}, нужно не меньше ${RUMORS_PER_CHAPTER}` });
  }
  return out;
}
