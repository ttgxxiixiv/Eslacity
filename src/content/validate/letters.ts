import { REGISTERS } from '../../domain/expression';
import { LETTER_MAX_WORDS, LETTER_MIN_WORDS, wordCount as letterWords } from '../../domain/letter';
import { checkNote, NOTE_SAMPLE_WORDS } from '../../domain/note';
import { CHAPTERS } from '../../domain/chapters';
import { LOCATION_IDS, type LettersFile } from '../schema';
import { type Issue, empty } from './common';

/** Письма с образцом (глава V) и записки (главы II–IV). */

/** Пунктов в чек-листе письма: обращение, связки, вежливая формула, прощание, регистр. */
export const LETTER_CHECKS = [4, 6] as const;

/**
 * Письма с образцом (задача 7.7): id `lt:<место>`, одно письмо на место, у места есть житель, регистр из списка,
 * просьба и задание не пустые, образец 40–80 слов, в чек-листе 4–6 пунктов, и каждый пример пункта есть в образце дословно.
 */
export function validateLetters(file: LettersFile | undefined, residents: Record<string, string>): Issue[] {
  const out: Issue[] = [];
  if (!file) return out;
  const seen = new Set<string>();
  file.letters.forEach((l, i) => {
    const at = `letters.json#${i} ${l.id}`;
    const err = (msg: string) => out.push({ level: 'error', where: at, msg });
    if (l.id !== `lt:${l.location}`) err(`id должен быть lt:${l.location}`);
    if (seen.has(l.location)) err('второе письмо того же места');
    seen.add(l.location);
    if (!(LOCATION_IDS as readonly string[]).includes(l.location)) err(`место "${l.location}"`);
    else if (!residents[l.location]) err('у места нет жителя');
    if (!REGISTERS.includes(l.register)) err(`регистр "${l.register}"`);
    if (!Number.isInteger(l.chapter) || l.chapter < 1 || l.chapter > 5) err(`глава ${l.chapter}`);
    for (const f of ['title', 'task', 'sample'] as const) if (empty(l[f])) err(`пустое поле ${f}`);
    if (empty(l.request?.es) || empty(l.request?.ru)) err('пустая просьба жителя');
    const n = letterWords(l.sample ?? '');
    if (n < LETTER_MIN_WORDS || n > LETTER_MAX_WORDS) err(`в образце ${n} слов, нужно ${LETTER_MIN_WORDS}–${LETTER_MAX_WORDS}`);
    const checks = l.checks ?? [];
    if (checks.length < LETTER_CHECKS[0] || checks.length > LETTER_CHECKS[1]) err(`пунктов чек-листа ${checks.length}, нужно ${LETTER_CHECKS.join('–')}`);
    for (const c of checks) {
      if (empty(c.label) || !c.examples?.length) err('пункт чек-листа без названия или примеров');
      for (const e of c.examples ?? []) if (empty(e) || !(l.sample ?? '').includes(e)) err(`пример «${e}» не найден в образце`);
    }
  });
  return out;
}

/** Записки (задача 12.5): главы и сколько записок в каждой. */
export const NOTE_CHAPTERS = [2, 3, 4] as const;

export const NOTES_PER_CHAPTER = 3;

/** Пунктов `must` в записке. */
export const NOTE_MUST = [2, 4] as const;

/** Доля незнакомых слов в образце к уровню главы: записка короткая, поэтому чуть свободнее, чем у сцен. */
export const NOTE_UNKNOWN_MAX = 0.1;

/**
 * Записки жителям: id `nt:<место>`, одна на место, по три на главу II–IV, образец 15–30 слов, и в образце есть
 * всё из `must` (иначе проверка ругала бы и образцовую записку).
 */
export function validateNotes(
  file: LettersFile | undefined,
  residents: Record<string, string>,
  coverage?: (text: string, level: number) => { total: number; unknown: string[] },
): Issue[] {
  const out: Issue[] = [];
  const notes = file?.notes ?? [];
  const seen = new Set<string>();
  notes.forEach((n, i) => {
    const at = `letters.json#notes.${i} ${n.id}`;
    const err = (msg: string) => out.push({ level: 'error', where: at, msg });
    if (n.id !== `nt:${n.location}`) err(`id должен быть nt:${n.location}`);
    if (seen.has(n.location)) err('вторая записка того же места');
    seen.add(n.location);
    if (!(LOCATION_IDS as readonly string[]).includes(n.location)) err(`место "${n.location}"`);
    else if (!residents[n.location]) err('у места нет жителя');
    if (!REGISTERS.includes(n.register)) err(`регистр "${n.register}"`);
    if (!(NOTE_CHAPTERS as readonly number[]).includes(n.chapter)) err(`глава ${n.chapter}, записки — в главах ${NOTE_CHAPTERS.join(', ')}`);
    for (const f of ['title', 'task', 'sample'] as const) if (empty(n[f])) err(`пустое поле ${f}`);
    if (empty(n.request?.es) || empty(n.request?.ru)) err('пустая просьба жителя');
    const words = letterWords(n.sample ?? '');
    if (words < NOTE_SAMPLE_WORDS[0] || words > NOTE_SAMPLE_WORDS[1]) err(`в образце ${words} слов, нужно ${NOTE_SAMPLE_WORDS.join('–')}`);
    const must = n.must ?? [];
    if (must.length < NOTE_MUST[0] || must.length > NOTE_MUST[1]) err(`пунктов must ${must.length}, нужно ${NOTE_MUST.join('–')}`);
    must.forEach((m, k) => {
      if (empty(m.label) || empty(m.hint) || !m.any?.length || m.any.some(empty)) err(`must ${k}: нужны label, hint и варианты any`);
    });
    for (const k of checkNote(n.sample ?? '', must).missing) err(`в образце нет «${must[k].label}»`);
    const level = CHAPTERS[n.chapter - 1]?.levels.at(-1);
    if (coverage && level && n.sample) {
      const c = coverage(n.sample, level);
      if (c.unknown.length > Math.floor(c.total * NOTE_UNKNOWN_MAX)) err(`незнакомых слов к главе ${n.chapter}: ${c.unknown.join(', ')}`);
    }
  });
  for (const ch of NOTE_CHAPTERS) {
    const count = notes.filter((n) => n.chapter === ch).length;
    if (file && count !== NOTES_PER_CHAPTER) out.push({ level: 'error', where: 'letters.json notes', msg: `записок главы ${ch}: ${count}, нужно ${NOTES_PER_CHAPTER}` });
  }
  return out;
}
