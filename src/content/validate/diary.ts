import { DIARY_PER_CHAPTER, DIARY_TOPICS } from '../../domain/diary';
import type { Scene } from '../schema';
import { type Issue, empty } from './common';

/** Дневник путника. */

/**
 * Дневник путника (задача 13.8): id `dy:<глава>.<n>`, тема из `DIARY_TOPICS`, факт по-русски, цитата — реплика источника
 * слово в слово. Источник: разговор `sc:` или сцена Летописца `th:` с номером реплики (не реплика героя и не реплика
 * с условием: её видят не все) или слух `rm:`. Глава записи — глава источника, записей на главу не меньше `DIARY_PER_CHAPTER`.
 */
export function validateDiary(
  file: { entries?: { id: string; chapter: number; topic: string; from: string; line?: number; ru: string; es: string }[] } | undefined,
  sources: { scenes: Scene[]; rumors: { id: string; chapter: number; es: string }[] },
): Issue[] {
  const out: Issue[] = [];
  const at = 'diary.json';
  if (!file) return [{ level: 'error', where: at, msg: 'нет файла дневника' }];
  const scenes = new Map(sources.scenes.map((s) => [s.id, s]));
  const rumors = new Map(sources.rumors.map((r) => [r.id, r]));
  const ids = new Set<string>();
  const froms = new Set<string>();
  for (const e of file.entries ?? []) {
    const where = `${at} ${e.id}`;
    const err = (msg: string) => out.push({ level: 'error', where, msg });
    if (!/^dy:[1-5]\.\d+$/.test(e.id) || e.id.split(':')[1].split('.')[0] !== String(e.chapter)) err('id должен быть dy:<глава>.<n>');
    if (ids.has(e.id)) err('дубль id');
    ids.add(e.id);
    if (!(e.topic in DIARY_TOPICS)) err(`неизвестная тема "${e.topic}"`);
    if (empty(e.ru) || !/\p{Script=Cyrillic}/u.test(e.ru)) err('нет факта по-русски');
    const key = `${e.from}#${e.line ?? ''}`;
    if (froms.has(key)) err(`источник "${key}" уже у другой записи`);
    froms.add(key);
    if (e.from.startsWith('rm:')) {
      const r = rumors.get(e.from);
      if (!r) err(`нет слуха "${e.from}"`);
      else {
        if (r.chapter !== e.chapter) err(`слух из главы ${r.chapter}`);
        if (r.es !== e.es) err('цитата не совпадает со слухом');
      }
      continue;
    }
    const sc = scenes.get(e.from);
    if (!sc || !/^(sc|th):/.test(e.from)) {
      err(`нет разговора "${e.from}"`);
      continue;
    }
    if (sc.chapter !== e.chapter) err(`разговор из главы ${sc.chapter}`);
    const line = e.line === undefined ? undefined : sc.lines[e.line];
    if (!line) err(`нет реплики ${e.line}`);
    else {
      if (line.who === 'hero') err('цитата — реплика героя');
      if (line.if) err('реплика с условием: её видят не все');
      if (line.es !== e.es) err('цитата не совпадает с репликой');
    }
  }
  for (const ch of [1, 2, 3, 4, 5]) {
    const n = (file.entries ?? []).filter((e) => e.chapter === ch).length;
    if (n < DIARY_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `записей главы ${ch}: ${n}, нужно не меньше ${DIARY_PER_CHAPTER}` });
  }
  return out;
}
