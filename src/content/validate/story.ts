import { conditionGroups, conditionIssues, missionSayChains, storyFlags } from '../../domain/story';
import type { LocationMissions, LocationScenes, ThreadFile } from '../schema';
import type { Issue } from './common';

/** Выбор с последствиями: развилки, флаги истории и реплики с условием. */

/**
 * Выбор с последствиями (задача 13.6): развилки миссий и реплики с условием. В развилке каждая ветка ставит один и тот же
 * флаг, у каждой своё значение. Условия — только в обычных сценах и репликах миссий (не в шёпотах и нити глав),
 * группа реплик с условием закрывает все значения флага (`conditionIssues`). Флаг без последствий — предупреждение.
 */
/** Главы с развилками и их наименьшее число (задача 13.6). */
export const STORY_FORKS = { chapters: [1, 2, 3, 4], min: 2 };

export function validateStory(
  scenes: { name: string; data: LocationScenes }[],
  missions: { name: string; data: LocationMissions }[],
  thread?: { name: string; data: ThreadFile },
  forks?: { chapters: number[]; min: number },
): Issue[] {
  const out: Issue[] = [];
  const all = missions.flatMap((f) => f.data.missions ?? []);
  const flags = storyFlags(all);
  // Развилок в главе не меньше `min`: у каждой главы, кроме последней, свои последствия в следующей.
  for (const ch of forks?.chapters ?? []) {
    const n = [...flags.values()].filter((f) => f.chapter === ch).length;
    if (n < forks!.min) out.push({ level: 'error', where: 'missions', msg: `в главе ${ch} развилок ${n}, нужно не меньше ${forks!.min}` });
  }
  const used = new Set<string>();
  for (const f of missions) {
    for (const m of f.data.missions ?? []) {
      const at = `missions/${f.name} ${m.id}`;
      for (const [id, n] of Object.entries(m.nodes ?? {})) {
        if (n.kind !== 'answer' || !n.branches.some((b) => b.sets)) continue;
        const keys = n.branches.map((b) => Object.keys(b.sets ?? {}).sort().join(','));
        if (new Set(keys).size !== 1) out.push({ level: 'error', where: `${at} ${id}`, msg: 'развилка: каждая ветка ставит те же флаги' });
        for (const k of Object.keys(n.branches[0].sets ?? {})) {
          const vals = n.branches.map((b) => b.sets?.[k]);
          if (new Set(vals).size !== vals.length) out.push({ level: 'error', where: `${at} ${id}`, msg: `развилка: у веток одинаковое значение флага "${k}"` });
        }
      }
      for (const chain of missionSayChains(m)) {
        const groups = conditionGroups(chain);
        groups.forEach((g) => used.add(g[0].flag));
        for (const msg of conditionIssues(groups, flags, m.chapter)) out.push({ level: 'error', where: at, msg });
      }
    }
  }
  const sceneFiles = [...scenes.map((f) => ({ ...f, dir: 'scenes' })), ...(thread ? [{ ...thread, dir: 'scenes', data: thread.data as unknown as LocationScenes }] : [])];
  for (const f of sceneFiles) {
    for (const sc of f.data.scenes ?? []) {
      const at = `${f.dir}/${f.name} ${sc.id}`;
      const conds = (sc.lines ?? []).map((l) => l.if);
      if (!conds.some(Boolean)) continue;
      if (sc.mode === 'overhear' || sc.trigger || !sc.id.startsWith('sc:')) {
        out.push({ level: 'error', where: at, msg: 'реплики с условием бывают только в обычных сценах' });
        continue;
      }
      const groups = conditionGroups(conds);
      groups.forEach((g) => used.add(g[0].flag));
      for (const msg of conditionIssues(groups, flags, sc.chapter)) out.push({ level: 'error', where: at, msg });
      if (sc.lines.every((l) => l.if)) out.push({ level: 'error', where: at, msg: 'в сцене нет реплик без условия' });
    }
  }
  for (const k of flags.keys()) if (!used.has(k)) out.push({ level: 'warning', where: 'missions', msg: `флаг "${k}" не меняет ни одной реплики` });
  return out;
}
