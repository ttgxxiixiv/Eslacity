import { normalize } from '../../domain/answer';
import { CHAPTERS as PLAN } from '../vocabPlan';
import { THREAD_TRIGGERS, threadId } from '../../domain/thread';
import { LOCATION_IDS, type LocationScenes, type Scene, type ThreadFile } from '../schema';
import { type Issue, empty, textKeys } from './common';

/** Сцены мест, шёпоты главы IV и нить глав (сцены Летописца и записки). */

/** Доля незнакомых слов в сцене, выше которой сцена не проходит проверку. */
export const SCENE_UNKNOWN_MAX = 0.07;

/** Шёпоты — подслушанные разговоры Леса шёпотов (глава IV). */
export const OVERHEAR_CHAPTER = 4;

/** Шёпот короче этого — не разговор, а обмен репликами. */
export const OVERHEAR_MIN_LINES = 6;

export const OVERHEAR_MIN_QUESTIONS = 3;

export interface SceneChecks {
  /** Место → id его жителя. */
  residents: Record<string, string>;
  /** id жителя → высота голоса: в шёпоте два голоса должны различаться на слух. */
  pitch?: Record<string, number>;
  /** Слова реплик: всего и незнакомые к уровню главы (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
}

export interface SceneReport {
  scenes: number;
  /** Из них шёпотов. */
  whispers: number;
  words: number;
  unknown: number;
}

/**
 * Сцены мест: `scenes/<место>.json`. id `sc:<место>.<глава>`, житель — житель этого места, реплики героя и жителей,
 * вопросы на понимание. Незнакомых слов (не из словаря мест уровней главы и ниже и не из грамматики) не больше 7%,
 * каждое такое слово переведено в `gloss`, иначе нажатие на него ничего не покажет.
 */
export function validateScenes(files: { name: string; data: LocationScenes }[], checks: SceneChecks): { issues: Issue[]; report: SceneReport } {
  const out: Issue[] = [];
  const report: SceneReport = { scenes: 0, whispers: 0, words: 0, unknown: 0 };
  const ids = new Set<string>();
  const npcIds = new Set(Object.values(checks.residents));
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.scenes) || !data.scenes.length) {
      out.push({ level: 'error', where: name, msg: 'нет сцен' });
      continue;
    }
    for (const sc of data.scenes) {
      const at = `scenes/${name} ${sc.id ?? '?'}`;
      report.scenes++;
      const overhear = sc.mode === 'overhear';
      if (overhear) report.whispers++;
      if (sc.mode !== undefined && !overhear) out.push({ level: 'error', where: at, msg: `вид сцены "${sc.mode}"` });
      const prefix = overhear ? 'wh' : 'sc';
      if (sc.id !== `${prefix}:${data.location}.${sc.chapter}`) out.push({ level: 'error', where: at, msg: `id должен быть "${prefix}:${data.location}.${sc.chapter}"` });
      if (ids.has(sc.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(sc.id);
      const plan = PLAN[sc.chapter - 1];
      if (!plan) out.push({ level: 'error', where: at, msg: `глава ${sc.chapter}` });
      if (sc.npc !== checks.residents[data.location]) out.push({ level: 'error', where: at, msg: `житель "${sc.npc}", в этом месте живёт "${checks.residents[data.location]}"` });
      out.push(...sceneBodyIssues(sc, at, npcIds, checks, report));
      if (overhear) out.push(...overhearIssues(sc, at, checks.residents[data.location], npcIds, checks.pitch));
    }
  }
  return { issues: out, report };
}

/**
 * Общее у сцен мест и нити глав: реплики, вопросы на понимание, `gloss` и доля незнакомых слов к уровню главы
 * (слова считаются в `report`).
 */
function sceneBodyIssues(sc: Scene, at: string, npcIds: ReadonlySet<string>, checks: Pick<SceneChecks, 'coverage'>, report: SceneReport): Issue[] {
  const out: Issue[] = [];
  const overhear = sc.mode === 'overhear';
  const plan = PLAN[sc.chapter - 1];
  const lines = sc.lines ?? [];
  if (lines.length < 2) out.push({ level: 'error', where: at, msg: 'меньше двух реплик' });
  if (!lines.some((l) => l.who === 'npc')) out.push({ level: 'error', where: at, msg: 'житель не говорит ни одной реплики' });
  lines.forEach((l, i) => {
    if (l.who !== 'npc' && l.who !== 'hero' && !npcIds.has(l.who)) out.push({ level: 'error', where: `${at} #${i}`, msg: `кто говорит: "${l.who}"` });
    if (empty(l.es) || empty(l.ru)) out.push({ level: 'error', where: `${at} #${i}`, msg: 'пустая реплика или перевод' });
  });
  const qs = sc.questions ?? [];
  if (!qs.length) out.push({ level: 'error', where: at, msg: 'нет вопросов на понимание' });
  qs.forEach((q, i) => {
    const opts = q.options ?? [];
    if (empty(q.q)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'пустой вопрос' });
    if (opts.length < 2 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) {
      out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'нужно 2–4 разных варианта' });
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `ответ ${q.answer}` });
    if (q.kind !== undefined && (q.kind !== 'stance' || !overhear)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `вид вопроса "${q.kind}" бывает только у шёпота` });
    if (overhear && q.kind !== 'stance') out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'в шёпоте вопросы вида stance' });
  });
  const text = lines.map((l) => l.es).join(' ');
  // Слова реплик так же, как их нажимают на экране сцены: «dell'Elisir» — это «dell'» и «elisir».
  // Женские формы реплик (`fem`) тоже нажимаются: их слова в gloss не лишние.
  const keys = new Set(lines.flatMap((l) => [l.es ?? '', l.fem?.es ?? ''].flatMap(textKeys)));
  const gloss = Object.fromEntries(Object.entries(sc.gloss ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const [k, v] of Object.entries(gloss)) {
    if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
    if (!keys.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в репликах` });
  }
  if (plan && checks.coverage) {
    const level = Math.max(...plan.levels);
    const cov = checks.coverage(text, level);
    report.words += cov.total;
    report.unknown += cov.unknown.length;
    const share = cov.total ? cov.unknown.length / cov.total : 0;
    if (share > SCENE_UNKNOWN_MAX) {
      out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${Math.round(SCENE_UNKNOWN_MAX * 100)}%` });
    }
    const bare = [...new Set(cov.unknown)].filter((t) => !gloss[t]);
    if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
  }
  return out;
}

export interface ThreadChecks extends Pick<SceneChecks, 'coverage'> {
  /** id Летописца: он ведёт нить. */
  chronicler: string;
  /** id жителей: они могут вставить реплику в сцену нити. */
  residents: string[];
  /** Главы, у которых нить уже написана: у каждой ровно три сцены. */
  chapters: number[];
  /** Записок у такой главы не меньше. */
  notesMin: number;
}

/**
 * Нить глав (задача 13.1): `scenes/thread.json`. Сцены Летописца `th:<глава>.<trigger>`, по одной на момент
 * (`open`, `half`, `climax`) у каждой главы из `chapters`, и записки конца дня по главам. Реплики, вопросы и доля
 * незнакомых слов проверяются как у сцен мест.
 */
export function validateThread(file: { name: string; data: ThreadFile } | undefined, checks: ThreadChecks): { issues: Issue[]; report: SceneReport } {
  const out: Issue[] = [];
  const report: SceneReport = { scenes: 0, whispers: 0, words: 0, unknown: 0 };
  if (!file) {
    if (checks.chapters.length) out.push({ level: 'error', where: 'scenes/thread.json', msg: 'нет нити глав' });
    return { issues: out, report };
  }
  const { name, data } = file;
  const where = `scenes/${name}`;
  if (data.location !== 'thread') out.push({ level: 'error', where, msg: 'location должен быть "thread"' });
  const npcIds = new Set(checks.residents);
  const ids = new Set<string>();
  for (const sc of data.scenes ?? []) {
    const at = `${where} ${sc.id ?? '?'}`;
    report.scenes++;
    if (!sc.trigger || !THREAD_TRIGGERS.includes(sc.trigger)) out.push({ level: 'error', where: at, msg: `момент нити "${sc.trigger}"` });
    else if (sc.id !== threadId(sc.chapter, sc.trigger)) out.push({ level: 'error', where: at, msg: `id должен быть "${threadId(sc.chapter, sc.trigger)}"` });
    if (sc.mode !== undefined) out.push({ level: 'error', where: at, msg: 'сцена нити — не шёпот' });
    if (!PLAN[sc.chapter - 1]) out.push({ level: 'error', where: at, msg: `глава ${sc.chapter}` });
    if (ids.has(sc.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
    ids.add(sc.id);
    if (sc.npc !== checks.chronicler) out.push({ level: 'error', where: at, msg: `нить ведёт Летописец "${checks.chronicler}", а не "${sc.npc}"` });
    out.push(...sceneBodyIssues(sc, at, npcIds, checks, report));
  }
  for (const ch of checks.chapters) {
    for (const t of THREAD_TRIGGERS) if (!ids.has(threadId(ch, t))) out.push({ level: 'error', where, msg: `у главы ${ch} нет сцены нити ${threadId(ch, t)}` });
    const notes = data.notes?.[String(ch)] ?? [];
    if (notes.length < checks.notesMin) out.push({ level: 'error', where, msg: `у главы ${ch} записок ${notes.length}, нужно не меньше ${checks.notesMin}` });
  }
  for (const [ch, notes] of Object.entries(data.notes ?? {})) {
    const plan = PLAN[Number(ch) - 1];
    if (!plan) out.push({ level: 'error', where, msg: `записки главы ${ch}` });
    notes.forEach((n, i) => {
      const at = `${where} записка ${ch}.${i + 1}`;
      if (empty(n.es) || empty(n.ru)) out.push({ level: 'error', where: at, msg: 'пустая записка или перевод' });
      else if (plan && checks.coverage) {
        // У записки нет перевода по нажатию: слова не из словаря главы переведены в её `gloss` и видны под ней.
        const level = Math.max(...plan.levels);
        const gloss = new Set(Object.keys(n.gloss ?? {}).map((k) => k.toLowerCase()));
        const bare = [...new Set(checks.coverage(n.es, level).unknown)].filter((t) => !gloss.has(t));
        if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
        const words = new Set(textKeys(n.es));
        for (const [k, v] of Object.entries(n.gloss ?? {})) {
          if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
          if (!words.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в записке` });
        }
      }
    });
  }
  return { issues: out, report };
}

/**
 * Шёпот: глава IV, герой молчит, говорят двое — житель места (`npc`) и ещё один житель, оба не меньше двух раз,
 * голоса разной высоты. Реплик не меньше шести, вопросов о подразумеваемом не меньше трёх.
 */
function overhearIssues(sc: Scene, at: string, resident: string | undefined, npcIds: ReadonlySet<string>, pitch?: Record<string, number>): Issue[] {
  const out: Issue[] = [];
  const lines = sc.lines ?? [];
  if (sc.chapter !== OVERHEAR_CHAPTER) out.push({ level: 'error', where: at, msg: `шёпоты бывают в главе ${OVERHEAR_CHAPTER}` });
  if (lines.length < OVERHEAR_MIN_LINES) out.push({ level: 'error', where: at, msg: `в шёпоте меньше ${OVERHEAR_MIN_LINES} реплик` });
  if ((sc.questions ?? []).length < OVERHEAR_MIN_QUESTIONS) out.push({ level: 'error', where: at, msg: `в шёпоте меньше ${OVERHEAR_MIN_QUESTIONS} вопросов` });
  if (lines.some((l) => l.who === 'hero')) out.push({ level: 'error', where: at, msg: 'в шёпоте герой только слушает' });
  const others = [...new Set(lines.map((l) => l.who).filter((w) => w !== 'npc' && w !== 'hero'))];
  if (others.length !== 1 || others[0] === resident) {
    out.push({ level: 'error', where: at, msg: 'в шёпоте говорят двое: житель места ("npc") и другой житель' });
    return out;
  }
  const other = others[0];
  for (const who of ['npc', other]) {
    if (lines.filter((l) => l.who === who).length < 2) out.push({ level: 'error', where: at, msg: `"${who}" говорит меньше двух реплик` });
  }
  if (pitch && resident && npcIds.has(other) && pitch[resident] === pitch[other]) {
    out.push({ level: 'error', where: at, msg: `у "${resident}" и "${other}" одинаковая высота голоса ${pitch[other]}` });
  }
  return out;
}
