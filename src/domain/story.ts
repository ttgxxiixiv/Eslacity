import type { DisputeMove, Mission, StoryCondition } from '../content/schema';

/**
 * Выбор с последствиями (задача 13.6). Ветка ответа в миссии ставит флаги истории (`sets`), реплики сцен и миссий
 * с условием (`if`) показываются только при нужном значении флага. Флаг ставится один раз: первый засчитанный выбор
 * остаётся, повторное прохождение историю не переписывает. Ошибка в развилке флаг не ставит.
 */

export interface StoryRecord {
  /** Флаг → значение. */
  flags: Record<string, string>;
  /** Ход спора, которым поставлен флаг: из них складывается приставка к титулу. */
  moves: Record<string, DisputeMove>;
}

export const EMPTY_STORY: StoryRecord = { flags: {}, moves: {} };

/** Значения условия списком: `null` — флаг не поставлен. */
export const conditionValues = (c: StoryCondition): (string | null)[] => (Array.isArray(c.is) ? c.is : [c.is]);

/** Условие выполнено при этих флагах. Без условия — всегда. */
export function storyAllows(c: StoryCondition | undefined, flags: Record<string, string>): boolean {
  if (!c) return true;
  return conditionValues(c).includes(flags[c.flag] ?? null);
}

/** Реплики, которые видит герой при этих флагах. Номер реплики в файле сохраняется (`index`): по нему отчёт об ошибке. */
export function visibleLines<T extends { if?: StoryCondition }>(lines: T[], flags: Record<string, string>): { line: T; index: number }[] {
  return lines.flatMap((line, index) => (storyAllows(line.if, flags) ? [{ line, index }] : []));
}

/**
 * Первый показанный узел миссии начиная с `id`: реплика жителя с невыполненным условием пропускается, диалог идёт
 * к её `next`. Ответы героя без условий.
 */
export function shownNode(m: Mission, id: string | undefined, flags: Record<string, string>): string | undefined {
  let cur = id;
  for (let guard = 0; cur && guard < 100; guard++) {
    const n = m.nodes[cur];
    if (!n || n.kind !== 'say' || storyAllows(n.if, flags)) return cur;
    cur = n.next;
  }
  return cur;
}

/** Новые флаги после ответа: уже поставленные не меняются. */
export function applySets(rec: StoryRecord, sets: Record<string, string> | undefined, move?: DisputeMove): StoryRecord {
  if (!sets) return rec;
  const fresh = Object.entries(sets).filter(([k]) => rec.flags[k] === undefined);
  if (!fresh.length) return rec;
  const flags = { ...rec.flags };
  const moves = { ...rec.moves };
  for (const [k, v] of fresh) {
    flags[k] = v;
    if (move) moves[k] = move;
  }
  return { flags, moves };
}

/** Приставка к титулу по ходу, который герой выбирал в развилках чаще других. */
export const EPITHET: Record<DisputeMove, string> = { object: 'Прямодушный', concede: 'Чуткий', compromise: 'Рассудительный' };
/** Все три хода поровну. */
export const EPITHET_MIXED = 'Непредсказуемый';
/** С этого числа развилок-споров у героя есть приставка. */
export const EPITHET_MIN = 2;

/**
 * Приставка к титулу: ход, которого больше всего (не меньше двух развилок). Ничья двух ходов — без приставки,
 * все три поровну — «Непредсказуемый».
 */
export function heroEpithet(moves: Record<string, DisputeMove>): string | undefined {
  const all = Object.values(moves);
  if (all.length < EPITHET_MIN) return undefined;
  const count = new Map<DisputeMove, number>();
  for (const m of all) count.set(m, (count.get(m) ?? 0) + 1);
  const top = Math.max(...count.values());
  const leaders = [...count].filter(([, n]) => n === top).map(([m]) => m);
  if (leaders.length === 1) return EPITHET[leaders[0]];
  return leaders.length === 3 ? EPITHET_MIXED : undefined;
}

/** Титул с приставкой: «Рассудительный Знаток». */
export const withEpithet = (title: string, epithet: string | undefined) => (epithet ? `${epithet} ${title}` : title);

/** Флаг, его значения и откуда он ставится: для валидатора. */
export interface StoryFlag {
  values: Set<string>;
  /** Глава миссии, где флаг ставится (самая поздняя, если мест несколько). */
  chapter: number;
}

/** Флаги, которые ставят ветки миссий. */
export function storyFlags(missions: Mission[]): Map<string, StoryFlag> {
  const out = new Map<string, StoryFlag>();
  for (const m of missions) {
    for (const n of Object.values(m.nodes ?? {})) {
      if (n.kind !== 'answer') continue;
      for (const b of n.branches) {
        for (const [k, v] of Object.entries(b.sets ?? {})) {
          const f = out.get(k) ?? { values: new Set<string>(), chapter: m.chapter };
          f.values.add(v);
          f.chapter = Math.max(f.chapter, m.chapter);
          out.set(k, f);
        }
      }
    }
  }
  return out;
}

/**
 * Ошибки группы реплик с условием. Группа — подряд идущие реплики с условием на один флаг. Каждое значение флага
 * должно встретиться в группе ровно один раз: тогда при любом выборе герой видит одну реплику. Без флага
 * (`null`: миссия пройдена до 2.151.0 или в развилке была ошибка) группа может молчать, поэтому реплики группы —
 * добавочные, сцена понятна и без них. Флаг ставится в миссии раньше главы реплики.
 */
export function conditionIssues(groups: StoryCondition[][], flags: Map<string, StoryFlag>, chapter: number): string[] {
  const out: string[] = [];
  for (const g of groups) {
    const flag = flags.get(g[0].flag);
    if (!flag) {
      out.push(`флаг "${g[0].flag}" не ставит ни одна миссия`);
      continue;
    }
    if (flag.chapter >= chapter) out.push(`флаг "${g[0].flag}" ставится в главе ${flag.chapter}, а реплика в главе ${chapter}: нужно позже`);
    const seen = new Map<string | null, number>();
    for (const c of g) for (const v of conditionValues(c)) seen.set(v, (seen.get(v) ?? 0) + 1);
    for (const v of seen.keys()) if (v !== null && !flag.values.has(v)) out.push(`у флага "${g[0].flag}" нет значения "${v}"`);
    for (const v of flag.values) {
      const n = seen.get(v) ?? 0;
      if (n === 0) out.push(`флаг "${g[0].flag}": нет реплики для "${v}"`);
      if (n > 1) out.push(`флаг "${g[0].flag}": для "${v}" ${n} реплики подряд`);
    }
    if ((seen.get(null) ?? 0) > 1) out.push(`флаг "${g[0].flag}": без флага ${seen.get(null)} реплики подряд`);
  }
  return out;
}

/** Группы условий в списке реплик: подряд идущие с условием на один флаг. */
export function conditionGroups(conds: (StoryCondition | undefined)[]): StoryCondition[][] {
  const out: StoryCondition[][] = [];
  let cur: StoryCondition[] = [];
  for (const c of conds) {
    if (c && cur.length && cur[0].flag === c.flag) cur.push(c);
    else {
      if (cur.length) out.push(cur);
      cur = c ? [c] : [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Цепочки реплик миссии подряд по `next`: условия в порядке показа, для `conditionGroups`. */
export function missionSayChains(m: Mission): (StoryCondition | undefined)[][] {
  const nodes = m.nodes ?? {};
  const out: (StoryCondition | undefined)[][] = [];
  for (const [id, n] of Object.entries(nodes)) {
    if (n.kind !== 'say') continue;
    // Начало цепочки — реплика, перед которой нет реплики жителя.
    if (Object.values(nodes).some((p) => p.kind === 'say' && p.next === id)) continue;
    const chain: (StoryCondition | undefined)[] = [];
    let cur: string | undefined = id;
    for (let guard = 0; cur && nodes[cur]?.kind === 'say' && guard < 100; guard++) {
      const s = nodes[cur] as Extract<typeof n, { kind: 'say' }>;
      chain.push(s.if);
      cur = s.next;
    }
    out.push(chain);
  }
  return out;
}
