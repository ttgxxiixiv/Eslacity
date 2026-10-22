import { normalize } from '../../domain/answer';
import { CHAPTERS as PLAN } from '../vocabPlan';
import { REGISTERS } from '../../domain/expression';
import { answersOnPath, DISPUTE_FROM_CHAPTER, isDispute, isRegisterNode, missionGraphIssues, REGISTER_FROM_CHAPTER } from '../../domain/mission';
import { LOCATION_IDS, type LocationMissions, type MissionAnswer, type Phrase, type PrologueFile } from '../schema';
import { type Issue, empty } from './common';
import { SCENE_UNKNOWN_MAX } from './scenes';

/** Сюжетные миссии (граф, ответы, споры, тон) и пролог. */

/** Меньше стольких ответов героя 80% означало бы «без единой ошибки». */
export const MISSION_MIN_ANSWERS = 5;

export interface MissionChecks {
  residents: Record<string, string>;
  /** Места кроме мест города: праздники (`fest-<id>`). */
  places?: readonly string[];
  /** Фразы мест: ответы героя — только фразы своего места. */
  phrases: Record<string, Phrase[]>;
  /** id существующих сцен. */
  scenes: ReadonlySet<string>;
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
  /** Тон жителей мест (`npcs.json`, поле register): узел тона у такого жителя требует его тона. */
  registers?: Record<string, 'formal' | 'informal' | undefined>;
}

/**
 * Узел тона: регистр из списка и тот же, что у жителя с постоянным тоном; реакция на чужой тон; ветки — фразы
 * с регистром, первая в нужном тоне (по ней плитки), и хотя бы одна в другом, иначе выбирать нечего.
 */
function toneIssues(n: MissionAnswer, own: Map<string, Phrase>, npcTone: 'formal' | 'informal' | undefined): string[] {
  const out: string[] = [];
  if (!REGISTERS.includes(n.register!)) return [`регистр узла "${n.register}"`];
  if (npcTone && n.register !== npcTone) out.push(`житель говорит только ${npcTone === 'formal' ? 'официально' : 'по-свойски'}, а узел ждёт "${n.register}"`);
  if (empty(n.tone?.es) || empty(n.tone?.ru)) out.push('нет реакции жителя на чужой тон (tone)');
  if (isDispute(n)) out.push('узел тона не может быть спором');
  const regs = n.branches.map((b) => own.get(b.phrase)?.register);
  if (regs.some((r) => !r)) out.push('у фраз узла тона должен быть register');
  if (regs[0] && regs[0] !== n.register) out.push('первая ветка узла тона должна быть в нужном тоне');
  if (!regs.some((r) => r && r !== n.register && r !== 'neutral')) out.push('в узле тона нет фразы в другом тоне');
  return out;
}

/**
 * Миссии мест: `missions/<место>.json`. id `ms:<место>.<глава>`, житель места, сцена-вступление той же главы,
 * граф без обрывов и циклов, ответы героя — фразы своего места уровней главы, у каждого ответа реакция на ошибку,
 * не меньше пяти ответов на пути. Реплики жителя (с реакциями) — не больше 7% незнакомых слов. С главы IV в миссии
 * есть спор: ответ с тремя ветками `move` (возразить, уступить, компромисс), у каждой своя реакция.
 */
export function validateMissions(files: { name: string; data: LocationMissions }[], checks: MissionChecks): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location) && !checks.places?.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.missions) || !data.missions.length) {
      out.push({ level: 'error', where: name, msg: 'нет миссий' });
      continue;
    }
    const own = new Map((checks.phrases[data.location] ?? []).map((p) => [p.id, p]));
    for (const m of data.missions) {
      const at = `missions/${name} ${m.id ?? '?'}`;
      if (m.id !== `ms:${data.location}.${m.chapter}`) out.push({ level: 'error', where: at, msg: `id должен быть "ms:${data.location}.${m.chapter}"` });
      if (ids.has(m.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(m.id);
      const plan = PLAN[m.chapter - 1];
      if (!plan) {
        out.push({ level: 'error', where: at, msg: `глава ${m.chapter}` });
        continue;
      }
      const maxLevel = Math.max(...plan.levels);
      if (m.npc !== checks.residents[data.location]) out.push({ level: 'error', where: at, msg: `житель "${m.npc}", в этом месте живёт "${checks.residents[data.location]}"` });
      if (m.scene !== undefined && (m.scene !== `sc:${data.location}.${m.chapter}` || !checks.scenes.has(m.scene))) {
        out.push({ level: 'error', where: at, msg: `нет сцены "${m.scene}" этого места и главы` });
      }
      for (const msg of missionGraphIssues(m)) out.push({ level: 'error', where: at, msg });
      // Спор (возразить, уступить, компромисс) — с главы IV, и там он обязателен.
      const disputes = Object.values(m.nodes ?? {}).filter((n) => n.kind === 'answer' && isDispute(n)).length;
      if (m.chapter >= DISPUTE_FROM_CHAPTER && !disputes) out.push({ level: 'error', where: at, msg: `в миссии главы ${m.chapter} нет спора (ветки с move)` });
      if (m.chapter < DISPUTE_FROM_CHAPTER && disputes) out.push({ level: 'error', where: at, msg: `спор бывает с главы ${DISPUTE_FROM_CHAPTER}` });
      // Узел тона (официально или по-свойски) — с главы V, и там он обязателен.
      const tones = Object.values(m.nodes ?? {}).filter((n) => n.kind === 'answer' && isRegisterNode(n)).length;
      if (m.chapter >= REGISTER_FROM_CHAPTER && !tones) out.push({ level: 'error', where: at, msg: `в миссии главы ${m.chapter} нет узла тона (register)` });
      if (m.chapter < REGISTER_FROM_CHAPTER && tones) out.push({ level: 'error', where: at, msg: `узел тона бывает с главы ${REGISTER_FROM_CHAPTER}` });
      const lines: string[] = [];
      for (const [id, n] of Object.entries(m.nodes ?? {})) {
        const where = `${at} ${id}`;
        if (n.kind === 'say') {
          if (empty(n.es) || empty(n.ru)) out.push({ level: 'error', where, msg: 'пустая реплика или перевод' });
          lines.push(n.es);
        } else if (n.kind === 'answer') {
          if (empty(n.task)) out.push({ level: 'error', where, msg: 'нет задачи героя (task)' });
          if (empty(n.wrong?.es) || empty(n.wrong?.ru)) out.push({ level: 'error', where, msg: 'нет реакции жителя на ошибку' });
          else lines.push(n.wrong.es);
          for (const b of n.branches ?? []) {
            const p = own.get(b.phrase);
            if (!p) out.push({ level: 'error', where, msg: `нет фразы "${b.phrase}" в фразах места` });
            else if (p.level > maxLevel) out.push({ level: 'error', where, msg: `фраза "${b.phrase}" уровня ${p.level}, в главе ${plan.chapter} — до ${maxLevel}` });
          }
          if (isRegisterNode(n)) out.push(...toneIssues(n, own, checks.registers?.[data.location]).map((msg) => ({ level: 'error' as const, where, msg })));
        } else {
          out.push({ level: 'error', where, msg: 'узел должен быть say или answer' });
        }
      }
      if (!missionGraphIssues(m).length && answersOnPath(m) < MISSION_MIN_ANSWERS) {
        out.push({ level: 'error', where: at, msg: `ответов героя ${answersOnPath(m)}, нужно не меньше ${MISSION_MIN_ANSWERS}` });
      }
      if (checks.coverage && lines.length) {
        const cov = checks.coverage(lines.join(' '), maxLevel);
        const share = cov.total ? cov.unknown.length / cov.total : 0;
        if (share > SCENE_UNKNOWN_MAX) {
          out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${Math.round(SCENE_UNKNOWN_MAX * 100)}%` });
        }
      }
    }
  }
  return out;
}

/**
 * Пролог (задача 13.2): три слова курса, у ответа жителя три варианта — эти слова, верный один; Привратник с голосом.
 * Слова реплик, которых нет в словаре первого уровня, — в `gloss` (`uncovered` считает по словарю курса).
 */
export function validatePrologue(
  data: PrologueFile | undefined,
  checks: { words: Map<string, { es: string; alt?: string[] }>; uncovered?: (text: string) => string[] },
): Issue[] {
  const where = 'prologue.json';
  if (!data) return [{ level: 'error', where, msg: 'нет пролога' }];
  const out: Issue[] = [];
  const err = (msg: string, at = where) => out.push({ level: 'error', where: at, msg });
  const g = data.gatekeeper;
  if (empty(g?.name) || empty(g?.role) || !g?.voice?.pitch || !g?.voice?.rate) err('у Привратника нет имени, роли или голоса');
  if (data.words?.length !== 3) err(`слов ${data.words?.length ?? 0}, нужно 3`);
  const plain = (s: string) => normalize(s);
  const forms = new Set<string>();
  for (const id of data.words ?? []) {
    const w = checks.words.get(id);
    if (!w) err(`нет слова ${id}`);
    else for (const f of [w.es, ...(w.alt ?? [])]) forms.add(plain(f));
  }
  const lines = [...(data.gate ?? []), ...(data.road ?? []), ...(data.finale ?? [])];
  for (const [i, l] of lines.entries()) {
    if (empty(l.es) || empty(l.ru)) err('пустая реплика', `${where}#${i}`);
    if (!['gatekeeper', 'resident', 'hero'].includes(l.who)) err(`кто говорит: ${l.who}`, `${where}#${i}`);
  }
  if (data.mission?.length !== 3) err(`ответов жителю ${data.mission?.length ?? 0}, нужно 3`);
  for (const [i, a] of (data.mission ?? []).entries()) {
    const at = `${where} ответ ${i + 1}`;
    if (empty(a.say?.es) || empty(a.say?.ru) || empty(a.wrong?.es) || empty(a.wrong?.ru)) err('пустая реплика жителя', at);
    if (a.options?.length !== 3 || a.answer < 0 || a.answer >= (a.options?.length ?? 0)) err('нужно три варианта и номер верного', at);
    for (const o of a.options ?? []) if (!forms.has(plain(o))) err(`вариант «${o}» — не слово пролога`, at);
    if (new Set((a.options ?? []).map(plain)).size !== (a.options?.length ?? 0)) err('одинаковые варианты', at);
  }
  const answers = new Set((data.mission ?? []).map((a) => plain(a.options?.[a.answer] ?? '')));
  if (answers.size !== 3) err('каждое слово пролога должно быть верным ответом один раз');
  if (checks.uncovered) {
    const gloss = new Set(Object.keys(data.gloss ?? {}).map((k) => k.toLowerCase()));
    const texts = [...lines.map((l) => l.es), ...(data.mission ?? []).flatMap((a) => [a.say.es, a.wrong.es])];
    const miss = [...new Set(texts.flatMap((t) => checks.uncovered!(t)))].filter((t) => !gloss.has(t));
    if (miss.length) out.push({ level: 'error', where, msg: `нет в словаре первого уровня и в gloss: ${miss.join(', ')}` });
  }
  return out;
}
