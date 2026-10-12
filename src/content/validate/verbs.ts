import { LANGS, type Lang } from '../../lang';
import { conjugate, generated, participle, TENSES, type Tense } from '../../domain/verbs';
import { pairIssue } from '../../domain/minimalPairs';
import type { VerbsFile, PairsFile } from '../schema';
import { type Issue, empty } from './common';
import { checkMaster } from './npcs';

/** Кузница глаголов и Звонница (минимальные пары). */

export const VERBS_MIN = 60;

/** Пар в противопоставлении не меньше: иначе звон из десяти заданий повторяет пары слишком часто. */
export const PAIRS_MIN = 6;

/** Звонница (задача 10.2): звонарь и противопоставления, каждая пара различается ровно тем, что заявлено. */
export function validatePairs(file: PairsFile | undefined, lang: Lang): Issue[] {
  const where = 'pairs.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла минимальных пар' }];
  const out: Issue[] = [];
  checkMaster(file.ringer, `${where} звонарь`, out);
  if (!file.contrasts?.length) out.push({ level: 'error', where, msg: 'нет противопоставлений' });
  const ids = new Set<string>();
  for (const c of file.contrasts ?? []) {
    const at = `${where} ${c.id}`;
    if (!/^[a-z-]+$/.test(c.id ?? '') || ids.has(c.id)) out.push({ level: 'error', where: at, msg: 'id пустой, с лишними знаками или повторяется' });
    ids.add(c.id);
    if (empty(c.title) || empty(c.hint)) out.push({ level: 'error', where: at, msg: 'нет названия или подсказки' });
    if (!LANGS[lang].pairKinds.includes(c.kind)) out.push({ level: 'error', where: at, msg: `вид "${c.kind}"` });
    if ((c.pairs?.length ?? 0) < PAIRS_MIN) out.push({ level: 'error', where: at, msg: `пар меньше ${PAIRS_MIN}` });
    const seen = new Set<string>();
    (c.pairs ?? []).forEach((p, i) => {
      const issue = pairIssue(c, p);
      if (issue) out.push({ level: 'error', where: `${at}.${i}`, msg: issue });
      const key = `${p[0]?.es}|${p[1]?.es}`;
      if (seen.has(key)) out.push({ level: 'error', where: `${at}.${i}`, msg: 'пара повторяется' });
      seen.add(key);
    });
  }
  return out;
}

export function validateVerbs(file: VerbsFile | undefined, lang: Lang): Issue[] {
  const out: Issue[] = [];
  const where = 'verbs.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла глаголов' }];
  checkMaster(file.smith, `${where} кузнец`, out);
  const profile = LANGS[lang].verbs;
  const seen = new Set<string>();
  for (const v of file.verbs ?? []) {
    const at = `${where} ${v.inf ?? '?'}`;
    if (seen.has(v.inf)) out.push({ level: 'error', where: at, msg: 'дубль глагола' });
    seen.add(v.inf);
    const badInf = empty(v.inf) || !profile.infinitive.test(v.inf);
    if (badInf) out.push({ level: 'error', where: at, msg: 'инфинитив с неожиданным окончанием' });
    if (empty(v.ru)) out.push({ level: 'error', where: at, msg: 'нет перевода' });
    for (const f of ['ch', 'isc', 'aux', 'past', 'dbl', 'stative'] as const) {
      if (v[f] !== undefined && !profile.fields.includes(f)) out.push({ level: 'error', where: at, msg: `поле ${f} не бывает у глаголов ${LANGS[lang].genitive}` });
    }
    // Генератор строит формы по окончанию инфинитива: с чужим окончанием дальше проверять нечего.
    if (badInf) continue;
    const bare = { inf: v.inf, ru: v.ru, ch: v.ch, isc: v.isc };
    if (v.pp && v.pp === participle(bare, lang)) out.push({ level: 'error', where: at, msg: 'причастие pp совпадает с правильным, запись не нужна' });
    if (v.yo && v.yo === conjugate(bare, 'presente', lang)[0]) out.push({ level: 'error', where: at, msg: 'форма yo совпадает с правильной, запись не нужна' });
    // Английское прошедшее: правильное не записывается, причастие, равное прошедшему, тоже.
    if (v.past && TENSES[lang].includes('past-simple') && v.past === conjugate({ ...bare, dbl: v.dbl }, 'past-simple', lang)[0]) {
      out.push({ level: 'error', where: at, msg: 'прошедшее past совпадает с правильным, запись не нужна' });
    }
    if (v.pp && v.past && v.pp === v.past) out.push({ level: 'error', where: at, msg: 'причастие pp совпадает с past, запись не нужна' });
    for (const [t, forms] of Object.entries(v.forms ?? {})) {
      if (!TENSES[lang].includes(t as Tense)) {
        out.push({ level: 'error', where: at, msg: `неизвестное время "${t}"` });
        continue;
      }
      if (!Array.isArray(forms) || forms.length !== 6 || forms.some((f) => empty(f))) {
        out.push({ level: 'error', where: at, msg: `${t}: нужно 6 непустых форм` });
        continue;
      }
      if (generated(v, t as Tense, lang).every((f, i) => f === forms[i])) {
        out.push({ level: 'error', where: at, msg: `${t}: совпадает с правильной формой, запись не нужна` });
      }
    }
  }
  if (seen.size < VERBS_MIN) out.push({ level: 'error', where, msg: `глаголов ${seen.size}, нужно не меньше ${VERBS_MIN}` });
  return out;
}
