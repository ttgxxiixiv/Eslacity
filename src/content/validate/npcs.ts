import { LISTEN_GUARDIAN_CHAPTERS } from '../../domain/guardian';
import { LOCATION_IDS, type Chronicler, type GuardiansFile, type NpcLook, type NpcsFile, type Smith } from '../schema';
import { type Issue, empty } from './common';

/** Жители, Летописец, стражи, мастера (кузнец, звонарь) и их портреты. */

const NPC_STYLES = new Set(['short', 'long', 'bun', 'curly', 'bald']);

const NPC_EXTRAS = new Set(['apron', 'glasses', 'headphones', 'chefhat', 'mustache', 'beard', 'cap', 'tie', 'headband', 'badge', 'stethoscope']);

const COLOR = /^#[0-9a-f]{6}$/i;

/** Общие проверки жителя и Летописца: поля, голос, формулировки поручений, тёплые приветствия, портрет. */
function checkNpc(n: Chronicler, at: string, noun: string, out: Issue[]) {
  for (const f of ['id', 'name', 'role', 'character'] as const) if (empty(n[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  if (empty(n.greeting?.es) || empty(n.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
  if (n.gender !== 'm' && n.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${n.gender}"` });
  const { pitch, rate } = n.voice ?? {};
  if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
  const er = n.errands ?? [];
  if (er.length < 3 || er.length > 4) out.push({ level: 'error', where: at, msg: `формулировок поручения ${er.length}, нужно 3–4` });
  for (const t of er) {
    if (empty(t) || !t.includes('{n}') || !t.includes(noun)) out.push({ level: 'error', where: at, msg: `поручение без {n} или ${noun}: «${t}»` });
  }
  if (n.warm?.length !== 3 || n.warm.some((w) => empty(w?.es) || empty(w?.ru))) {
    out.push({ level: 'error', where: at, msg: 'нужно 3 тёплых приветствия (warm) с переводом' });
  }
  checkLook(n.look, at, out);
}

/** Портрет жителя или стража: тон кожи, причёска, цвета, известные детали. */
function checkLook(lk: NpcLook | undefined, at: string, out: Issue[]) {
  if (!lk || ![1, 2, 3, 4].includes(lk.skin) || !NPC_STYLES.has(lk.style) || !COLOR.test(lk.hair) || !COLOR.test(lk.outfit) || !COLOR.test(lk.pants)) {
    out.push({ level: 'error', where: at, msg: 'неверный портрет (look)' });
  } else {
    for (const e of lk.extra) if (!NPC_EXTRAS.has(e)) out.push({ level: 'error', where: at, msg: `неизвестная деталь портрета "${e}"` });
  }
}

/**
 * Стражи земель (задача 5.4): у каждой главы из `chapters` (главы, где есть уроки грамматики) свой страж, один на главу;
 * имя, роль, пол, реплики с переводом (приветствие, победа, неудача), голос в пределах, портрет.
 */
export function validateGuardians(file: GuardiansFile | undefined, chapters: number[]): Issue[] {
  const out: Issue[] = [];
  const where = 'guardians.json';
  if (!file) return chapters.length ? [{ level: 'error', where, msg: 'нет файла стражей' }] : [];
  const seen = new Set<number>();
  file.guardians.forEach((g, i) => {
    const at = `${where}#${i} глава ${g.chapter}`;
    if (seen.has(g.chapter)) out.push({ level: 'error', where: at, msg: 'второй страж той же главы' });
    seen.add(g.chapter);
    if (!chapters.includes(g.chapter)) out.push({ level: 'error', where: at, msg: 'у главы нет уроков грамматики' });
    for (const f of ['name', 'role'] as const) if (empty(g[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
    if (g.gender !== 'm' && g.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${g.gender}"` });
    for (const f of ['greeting', 'win', 'lose', 'mid'] as const) if (empty(g[f]?.es) || empty(g[f]?.ru)) out.push({ level: 'error', where: at, msg: `пустая реплика ${f}` });
    const { pitch, rate } = g.voice ?? {};
    if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
    checkLook(g.look, at, out);
    // Хранительница леса слушает шёпоты: её испытание — на слух.
    if (LISTEN_GUARDIAN_CHAPTERS.includes(g.chapter) && g.listen !== true) out.push({ level: 'error', where: at, msg: 'страж этой главы проверяет на слух: нужно listen: true' });
  });
  for (const ch of chapters) if (!seen.has(ch)) out.push({ level: 'error', where, msg: `нет стража главы ${ch}` });
  return out;
}

/**
 * Кузница глаголов (задача 5.5): кузнец с репликой и портретом, не меньше 60 разных глаголов с переводом.
 * Записанная строка времени — шесть непустых форм, и она должна отличаться от того, что дал бы генератор окончаний:
 * правильные формы не записываются, генератор и данные не расходятся молча.
 */
/** Мастер без места (кузнец, звонарь): имя, роль, пол, приветствие, голос, облик. */
export function checkMaster(s: Smith | undefined, at: string, out: Issue[]) {
  if (!s) {
    out.push({ level: 'error', where: at, msg: 'нет' });
    return;
  }
  for (const f of ['name', 'role'] as const) if (empty(s[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  if (s.gender !== 'm' && s.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${s.gender}"` });
  if (empty(s.greeting?.es) || empty(s.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
  const { pitch, rate } = s.voice ?? {};
  if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
  checkLook(s.look, at, out);
}

/**
 * Рисованные портреты: у каждого персонажа с полем `look.portrait` должен быть файл картинки своего языка,
 * а имя — из строчных латинских букв и цифр. exists(имя) — есть ли `src/assets/portraits/<язык>/<имя>.webp`.
 */
export function validatePortraits(looks: { where: string; look?: NpcLook }[], exists: (name: string) => boolean): Issue[] {
  const out: Issue[] = [];
  for (const { where, look } of looks) {
    const p = look?.portrait;
    if (p === undefined) continue;
    if (!/^[a-z0-9]+$/.test(p)) out.push({ level: 'error', where, msg: `имя портрета "${p}": только строчные латинские буквы и цифры` });
    else if (!exists(p)) out.push({ level: 'error', where, msg: `нет картинки портрета ${p}.webp` });
  }
  return out;
}

/** Жители: по одному на каждое место, уникальные id, заполненные поля, голос и портрет в допустимых пределах. */
export function validateNpcs(file: NpcsFile | undefined): Issue[] {
  const out: Issue[] = [];
  const where = 'npcs.json';
  if (!file?.npcs?.length) return [{ level: 'error', where, msg: 'нет жителей' }];
  const ids = new Set<string>();
  const places = new Map<string, string>();
  for (const n of file.npcs) {
    const at = `${where} ${n.id ?? '?'}`;
    checkNpc(n, at, n.location === 'school' ? '{правил}' : '{слов}', out);
    if (ids.has(n.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
    ids.add(n.id);
    if (n.register !== undefined && n.register !== 'formal' && n.register !== 'informal') out.push({ level: 'error', where: at, msg: `тон жителя "${n.register}": formal или informal` });
    if (!(LOCATION_IDS as readonly string[]).includes(n.location)) out.push({ level: 'error', where: at, msg: `неизвестное место "${n.location}"` });
    else if (places.has(n.location)) out.push({ level: 'error', where: at, msg: `в месте ${n.location} уже живёт ${places.get(n.location)}` });
    else places.set(n.location, n.id);
  }
  for (const loc of LOCATION_IDS) if (!places.has(loc)) out.push({ level: 'error', where, msg: `в месте ${loc} нет жителя` });
  return out;
}

/** Летописец: те же проверки, что у жителя, но без места; поручения — слова свитка. */
export function validateChronicler(n: Chronicler | undefined, npcs: NpcsFile | undefined): Issue[] {
  const where = 'chronicler.json';
  if (!n) return [{ level: 'error', where, msg: 'нет Летописца' }];
  const out: Issue[] = [];
  checkNpc(n, where, '{слов}', out);
  if ('location' in n) out.push({ level: 'error', where, msg: 'у Летописца нет места, поле location лишнее' });
  if (npcs?.npcs.some((x) => x.id === n.id)) out.push({ level: 'error', where, msg: `id "${n.id}" уже занят жителем` });
  return out;
}
