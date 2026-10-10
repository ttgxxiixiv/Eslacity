/**
 * Сверка словаря курса с частотным списком (задача 0.4). Чистые функции, отчёт строит scripts/vocab-report.ts.
 */

export interface FreqEntry {
  rank: number;
  lemma: string;
  count: number;
  /** Леммы нет в словаре лемм: служебное слово, имя, английская вставка. */
  service: boolean;
}

const comment = (l: string) => l.startsWith('#') || !l.trim();

export function parseFreq(text: string): FreqEntry[] {
  return text
    .split('\n')
    .filter((l) => !comment(l))
    .map((l) => {
      const [rank, lemma, count, flag] = l.split('\t');
      return { rank: Number(rank), lemma, count: Number(count), service: flag === '?' };
    });
}

export function parseLemmas(text: string): Map<string, string> {
  return new Map(
    text
      .split('\n')
      .filter((l) => !comment(l))
      .map((l) => l.split('\t') as [string, string]),
  );
}

/** Слова строки: строчными, с апострофом элизии на конце («l'», «dall'»). Кириллица и цифры отбрасываются. */
export function tokens(text: string): string[] {
  return (text.toLowerCase().replace(/[’`]/g, "'").match(/[a-zà-öø-ÿ]+'?/g) ?? []).filter((t) => t !== "'");
}

/**
 * Лемма слова: по таблице форм, иначе возвратный глагол приводится к инфинитиву
 * (abrocharse → abrochar, allenarsi → allenare), иначе слово остаётся как есть.
 */
export function lemmaOf(token: string, forms: Map<string, string>, lang: string): string {
  const hit = forms.get(token);
  if (hit) return hit;
  if (lang === 'es' && /[aei]rse$/.test(token)) return token.slice(0, -2);
  if (lang === 'it' && /[aei]rsi$/.test(token)) return token.slice(0, -3) + 're';
  if (lang === 'it' && /[aei]rsene$/.test(token)) return token.slice(0, -5) + 're';
  return token;
}

export const lemmasIn = (text: string, forms: Map<string, string>, lang: string) =>
  tokens(text).map((t) => lemmaOf(t, forms, lang));

/** Уроки грамматики в том объёме, который нужен для лемм: теория, примеры, задания. */
export interface LessonText {
  theory: ({ kind: 'table'; rows: { cells: string[] }[] } | { kind: 'text' | 'tip'; md: string })[];
  examples: { es: string }[];
  exercises: (
    | { kind: 'choose'; prompt: string; options: string[] }
    | { kind: 'gap'; sentence: string; options: string[] }
    | { kind: 'truefalse'; statement: string }
    | { kind: 'build'; answer: string; extra: string[] }
    | { kind: 'type'; sentence: string; answer: string; alt?: string[] }
    // Задания C1 (задача 7.3).
    | { kind: 'transform'; source: string; keyword: string; answer: string; alt?: string[] }
    | { kind: 'combine'; first: string; second: string; connector: string; answer: string; alt?: string[] }
    | { kind: 'fix'; sentence: string; answer: string; alt?: string[] }
    | { kind: 'cloze'; text: string; answers: string[][] }
    | { kind: 'register'; source: string; options?: string[]; answer: number | string; alt?: string[]; extra?: string[] }
    | { kind: 'paraphrase'; sentence: string; options: string[] }
  )[];
}

type LessonExercise = LessonText['exercises'][number];

/** Что упражнение просит произвести или выбрать: варианты, собранные и вписанные ответы. */
function taughtStrings(e: LessonExercise): string[] {
  if ('options' in e && e.options) return e.options;
  switch (e.kind) {
    case 'build':
      return [e.answer];
    case 'type':
    case 'transform':
    case 'combine':
    case 'fix':
      return [e.answer, ...(e.alt ?? [])];
    case 'cloze':
      return e.answers.flat();
    case 'register':
      return typeof e.answer === 'string' ? [e.answer, ...(e.alt ?? [])] : [];
    default:
      return [];
  }
}

/** Весь текст упражнения на изучаемом языке. */
function exerciseText(e: LessonExercise): string {
  switch (e.kind) {
    case 'choose':
      return e.prompt;
    case 'gap':
    case 'type':
    case 'fix':
    case 'paraphrase':
      return e.sentence;
    case 'build':
      return [e.answer, ...e.extra].join(' ');
    case 'truefalse':
      return e.statement;
    case 'transform':
      return e.source;
    case 'combine':
      return [e.first, e.second].join(' ');
    case 'cloze':
      return e.text;
    case 'register':
      return [e.source, ...(e.extra ?? [])].join(' ');
  }
}

type Lem = (s: string) => string[];

/** Что учит грамматика: формы из таблиц, вариантов ответа, собираемых предложений и вписываемых форм. */
export function grammarLemmas(lessons: LessonText[], lem: Lem): Set<string> {
  return new Set(
    lessons.flatMap((l) => [
      ...l.theory.flatMap((b) => (b.kind === 'table' ? b.rows.flatMap((r) => r.cells.flatMap(lem)) : [])),
      ...l.exercises.flatMap((e) => taughtStrings(e).flatMap(lem)),
    ]),
  );
}

/** Где угодно в тексте курса: слова, их примеры, теория, примеры и задания уроков. */
export function anywhereLemmas(words: { es: string; alt?: string[]; example: { es: string } }[], lessons: LessonText[], lem: Lem): Set<string> {
  return new Set([
    ...words.flatMap((w) => [w.es, ...(w.alt ?? []), w.example.es].flatMap(lem)),
    ...grammarLemmas(lessons, lem),
    ...lessons.flatMap((l) => [
      ...l.theory.flatMap((b) => (b.kind === 'table' ? [] : lem(b.md))),
      ...l.examples.flatMap((x) => lem(x.es)),
      ...l.exercises.flatMap((e) => lem(exerciseText(e))),
    ]),
  ]);
}

/**
 * Словарь для фраз мест (задача 4.1): с какого уровня места известна лемма, что учит грамматика
 * и служебные слова, которые встречаются в курсе.
 */
export interface Lexicon {
  /** Лемма → самый низкий уровень места, где она есть среди слов. */
  wordLevel: Map<string, number>;
  /** Основа слова (без окончания) → уровень: узнаёт формы, которых нет в таблице лемм. */
  stemLevel: Map<string, number>;
  /** Основы глаголов → уровень: спряжённая форма начинается с основы (cobrar → cobra, portare → portate). */
  verbLevel: Map<string, number>;
  grammar: Set<string>;
  anywhere: Set<string>;
  service: Set<string>;
}

export function buildLexicon(
  words: { es: string; alt?: string[]; level: number; example: { es: string } }[],
  lessons: LessonText[],
  freq: FreqEntry[],
  lem: Lem,
): Lexicon {
  const wordLevel = new Map<string, number>();
  const stemLevel = new Map<string, number>();
  const verbLevel = new Map<string, number>();
  const put = (m: Map<string, number>, k: string, lvl: number) => m.set(k, Math.min(m.get(k) ?? Infinity, lvl));
  for (const w of words) {
    for (const l of [w.es, ...(w.alt ?? [])].flatMap(lem)) {
      put(wordLevel, l, w.level);
      put(stemLevel, stemOf(l), w.level);
      const verb = plain(l).match(/^(.{2,})(?:ar|er|ir|are|ere|ire)$/);
      if (verb) put(verbLevel, verb[1], w.level);
    }
  }
  return {
    wordLevel,
    stemLevel,
    verbLevel,
    grammar: grammarLemmas(lessons, lem),
    anywhere: anywhereLemmas(words, lessons, lem),
    service: new Set(freq.filter((e) => e.service).map((e) => e.lemma)),
  };
}

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/'$/, '');

/**
 * Основа формы для сравнения без таблицы лемм: без ударений, апострофа элизии, множественного -s/-es
 * и конечной гласной. melocotones → melocoton, llena → llen, ciliegie → ciliegi, quant' → quant.
 */
export function stemOf(token: string): string {
  let t = plain(token);
  if (t.length > 3 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  if (t.length > 3) t = t.replace(/[aeiou]$/, '');
  // Итальянское -io/-ia во множественном теряет i: riccio → ricci, ciliegia → ciliegie.
  return t.length > 4 ? t.replace(/i$/, '') : t;
}

/** Окончания спряжения для коротких основ, где сравнение по началу слова ошибалось бы: lav-a, lav-amos. */
const VERB_ENDINGS = /^(?:o|as|a|amos|ais|an|es|e|emos|eis|en|imos|is|i|iamo|ate|ete|ite|ano|ono|ando|endo|iendo|ado|ido|ato|uto|ito)$/;
/** Инфинитив с приклеенным местоимением: teñirme → teñ-ir, tingermi → ting-er. */
const CLITIC = /^(.+?)(?:ar|er|ir)(?:me|te|se|nos|os|lo|la|los|las|le|les|mi|ti|si|ci|vi|li|ne)$/;

/** Спряжённая форма или инфинитив с местоимением знакомого глагола: основа известна на этом уровне. */
function knownVerb(token: string, level: number, verbs: Map<string, number>): boolean {
  const t = plain(token);
  const known = (stem: string) => (verbs.get(stem) ?? Infinity) <= level;
  const clitic = t.match(CLITIC);
  if (clitic && known(clitic[1])) return true;
  for (let i = 2; i < t.length; i++) {
    const stem = t.slice(0, i);
    if (!known(stem)) continue;
    // Длинная основа: форма просто начинается с неё (cobra, portate). Короткая — только с окончанием спряжения.
    if (i >= 4 || VERB_ENDINGS.test(t.slice(i))) return true;
  }
  return false;
}

/**
 * Слова фразы, которые игрок к этому уровню ещё не знает: леммы нет среди слов мест уровня не выше
 * (ни в таблице лемм, ни по основе, ни как спряжённый глагол), её не учит грамматика, и это не служебное
 * слово, знакомое по текстам курса. Грамматика считается
 * известной целиком: уровень урока к уровню места не привязан.
 */
/** Знает ли игрок слово к этому уровню: см. `uncoveredWords`. */
export function isKnownWord(t: string, level: number, lex: Lexicon, forms: Map<string, string>, lang: string): boolean {
  const l = lemmaOf(t, forms, lang);
  return (
    (lex.wordLevel.get(l) ?? Infinity) <= level ||
    (lex.stemLevel.get(stemOf(t)) ?? Infinity) <= level ||
    knownVerb(t, level, lex.verbLevel) ||
    lex.grammar.has(l) ||
    (lex.service.has(l) && lex.anywhere.has(l))
  );
}

export function uncoveredWords(text: string, level: number, lex: Lexicon, forms: Map<string, string>, lang: string): string[] {
  const out: string[] = [];
  for (const t of tokens(text)) if (!isKnownWord(t, level, lex, forms, lang) && !out.includes(t)) out.push(t);
  return out;
}

/** Покрытие текста сцены: всего слов (с повторами) и незнакомые (тоже с повторами, для доли). */
export function textCoverage(text: string, level: number, lex: Lexicon, forms: Map<string, string>, lang: string): { total: number; unknown: string[] } {
  const all = tokens(text);
  return { total: all.length, unknown: all.filter((t) => !isKnownWord(t, level, lex, forms, lang)) };
}

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'il', 'lo', 'i', 'gli', 'le', "l'", "un'", 'uno']);

/**
 * Перевод слова текста по словарю курса: по лемме, по основе, спряжённый глагол — по основе инфинитива.
 * Из нескольких слов с той же леммой берётся слово самого низкого уровня. Для нажатия на слово в сцене.
 */
export function glossIndex(
  words: { es: string; alt?: string[]; ru: string; level: number }[],
  forms: Map<string, string>,
  lang: string,
): (token: string) => string | undefined {
  const byLemma = new Map<string, { ru: string; level: number }>();
  const byStem = new Map<string, { ru: string; level: number }>();
  const verbs = new Map<string, { ru: string; level: number }>();
  const put = (m: Map<string, { ru: string; level: number }>, k: string, v: { ru: string; level: number }) => {
    if ((m.get(k)?.level ?? Infinity) > v.level) m.set(k, v);
  };
  for (const w of words) {
    const v = { ru: w.ru, level: w.level };
    // Только однословные слова (артикль не в счёт): у словосочетаний «abrir una cuenta», «ida y vuelta»
    // отдельные слова значат другое, и «un» не должно переводиться как «открыть счёт».
    const single = [w.es, ...(w.alt ?? [])].map((x) => tokens(x)).filter((t) => t.length === 1 || (t.length === 2 && ARTICLES.has(t[0])));
    for (const l of single.map((t) => lemmaOf(t[t.length - 1], forms, lang))) {
      put(byLemma, l, v);
      put(byStem, stemOf(l), v);
      const verb = plain(l).match(/^(.{2,})(?:ar|er|ir|are|ere|ire)$/);
      if (verb) put(verbs, verb[1], v);
    }
  }
  const levels = new Map([...verbs].map(([k, v]) => [k, v.level]));
  return (token) => {
    const t = token.toLowerCase();
    // По основе — только слова от четырёх букв: иначе «per» совпало бы с «pera», а «te» с «tè».
    const hit = byLemma.get(lemmaOf(t, forms, lang)) ?? (plain(t).length >= 4 ? byStem.get(stemOf(t)) : undefined);
    if (hit) return hit.ru;
    const p = plain(t);
    for (let i = p.length - 1; i >= 2; i--) {
      const v = verbs.get(p.slice(0, i));
      if (v && knownVerb(t, v.level, levels)) return v.ru;
    }
    return undefined;
  };
}

export interface Coverage {
  /** Частотный список без шума: служебные леммы, которых нет нигде в тексте курса, выброшены. */
  ranked: FreqEntry[];
  /** Сколько служебных лемм выброшено как шум (имена, английские слова). */
  noise: number;
  covered: (lemma: string) => 'words' | 'grammar' | null;
}

/**
 * Покрытие частотного списка.
 * - Слово засчитано словами, если его лемма есть среди слов мест (с учётом слов внутри фраз).
 * - Засчитано грамматикой, если оно в таблицах или вариантах ответа уроков грамматики.
 * - Служебное слово засчитано, если встречается где угодно в курсе (в примерах, в тексте уроков):
 *   их учат в контексте. Служебные леммы, которых в курсе нет совсем, считаются шумом и выбрасываются,
 *   поэтому ранги в отчёте идут по очищенному списку.
 */
export function coverage(
  freq: FreqEntry[],
  sets: { words: Set<string>; grammar: Set<string>; anywhere: Set<string> },
): Coverage {
  const ranked: FreqEntry[] = [];
  let noise = 0;
  for (const e of freq) {
    if (e.service && !sets.anywhere.has(e.lemma) && !sets.words.has(e.lemma)) {
      noise++;
      continue;
    }
    ranked.push({ ...e, rank: ranked.length + 1 });
  }
  const service = new Set(freq.filter((e) => e.service).map((e) => e.lemma));
  const covered = (lemma: string) => {
    if (sets.words.has(lemma)) return 'words' as const;
    if (sets.grammar.has(lemma)) return 'grammar' as const;
    if (service.has(lemma) && sets.anywhere.has(lemma)) return 'grammar' as const;
    return null;
  };
  return { ranked, noise, covered };
}

/** Доля покрытых среди первых n лемм очищенного списка. */
export function share(cov: Coverage, n: number): { words: number; total: number; n: number } {
  const top = cov.ranked.slice(0, n);
  let words = 0;
  let total = 0;
  for (const e of top) {
    const c = cov.covered(e.lemma);
    if (c === 'words') words++;
    if (c) total++;
  }
  return { words, total, n: top.length };
}

/** Полосы частотного списка и главы, в которые предлагается брать слова из каждой. */
export const BANDS = [
  { from: 1, to: 1000, chapters: 'I–II (A1–A2)' },
  { from: 1001, to: 2000, chapters: 'III (B1)' },
  { from: 2001, to: 3000, chapters: 'IV (B2)' },
  { from: 3001, to: 5000, chapters: 'V (C1)' },
];

/** Ранг леммы в очищенном частотном списке (задача 12.1). */
export function lemmaRanks(cov: Coverage): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of cov.ranked) if (!out.has(e.lemma)) out.set(e.lemma, e.rank);
  return out;
}

/**
 * Ранг слова курса: ранг его единственной леммы (артикль не в счёт), слова вне списка — Infinity.
 * У словосочетаний («abrir una cuenta», «por favor») ранга нет: undefined. Их смысл складывается из частей,
 * и редкость одной части не делает редким всё выражение.
 */
export function wordRank(es: string, forms: Map<string, string>, lang: string, ranks: Map<string, number>): number | undefined {
  const t = tokens(es).filter((x) => !ARTICLES.has(x));
  if (t.length !== 1) return undefined;
  return ranks.get(lemmaOf(t[0], forms, lang)) ?? Infinity;
}

/** Медиана рангов (Infinity — слово вне списка); пустой список — undefined. */
export function median(ranks: number[]): number | undefined {
  if (!ranks.length) return undefined;
  const s = [...ranks].sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
}

/** Слово уровней 1–4 считается редким, если его лемма дальше этого ранга (или вне списка). */
export const RARE_RANK = 5000;
/** Тематических редких слов (`topical`) не больше стольких на урок. */
export const TOPICAL_PER_LESSON = 3;

export interface Skips {
  drop: Set<string>;
  alias: Map<string, string>;
}

/** Поправки к частотному списку: `scripts/data/skip-<язык>.txt`. */
export function parseSkips(text: string): Skips {
  const drop = new Set<string>();
  const alias = new Map<string, string>();
  for (const l of text.split('\n')) {
    if (comment(l)) continue;
    const [from, to] = l.split('>').map((x) => x.trim());
    if (to) alias.set(from, to);
    else drop.add(from);
  }
  return { drop, alias };
}

/**
 * Частотный список с поправками: выброшенные леммы убираются, форма другой леммы складывается с ней
 * (частота прибавляется, место — по большей из двух). Ранги пересчитываются.
 */
export function applySkips(freq: FreqEntry[], skips: Skips): FreqEntry[] {
  const merged = new Map<string, FreqEntry>();
  for (const e of freq) {
    if (skips.drop.has(e.lemma)) continue;
    const lemma = skips.alias.get(e.lemma) ?? e.lemma;
    const prev = merged.get(lemma);
    if (prev) prev.count += e.count;
    else merged.set(lemma, { ...e, lemma, service: e.lemma === lemma ? e.service : false });
  }
  return [...merged.values()].sort((a, b) => b.count - a.count).map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Редкие слова на ранних уровнях (задача 12.1). Слово уровней 1–4 дальше `RARE_RANK` должно быть помечено
 * `topical` (тематическое, без него место не обходится), таких не больше `TOPICAL_PER_LESSON` на урок.
 * Пометка у частого слова или на уровне выше 4 — лишняя. `parts` делит слова уровня на уроки, как игра.
 */
export function rarityIssues<W extends { id: string; es: string; topical?: boolean }>(
  levels: { level: number; words: W[] }[],
  rank: (es: string) => number | undefined,
  parts: (words: W[]) => W[][],
): { id: string; msg: string }[] {
  const out: { id: string; msg: string }[] = [];
  for (const { level, words } of levels) {
    for (const w of words) {
      const r = rank(w.es);
      const rare = r !== undefined && r > RARE_RANK;
      if (w.topical && level > 4) out.push({ id: w.id, msg: `пометка topical на уровне ${level}, она бывает только на уровнях 1–4` });
      else if (w.topical && !rare) out.push({ id: w.id, msg: `пометка topical у частого слова (ранг ${r ?? 'словосочетание'})` });
      else if (rare && level <= 4 && !w.topical)
        out.push({ id: w.id, msg: `редкое слово на уровне ${level} (ранг ${r === Infinity ? 'вне списка' : r}): поднять на уровень 5–6 или пометить topical` });
    }
    if (level > 4) continue;
    parts(words).forEach((p, i) => {
      const n = p.filter((w) => w.topical).length;
      if (n > TOPICAL_PER_LESSON) out.push({ id: p[0].id, msg: `урок ${i + 1} уровня ${level}: тематических слов ${n}, не больше ${TOPICAL_PER_LESSON}` });
    });
  }
  return out;
}

/**
 * Таблица форм с теми же поправками: форма, записанная леммой `a` из строки «a > b», теперь ведёт к `b`,
 * и сама форма `a` тоже. Строка «a > a» чинит форму, которую таблица уводит к чужой лемме (scorso → scorrere).
 */
export function applySkipsToForms(forms: Map<string, string>, skips: Skips): Map<string, string> {
  const out = new Map(forms);
  for (const [form, lemma] of forms) {
    const to = skips.alias.get(lemma);
    if (to) out.set(form, to);
  }
  for (const [from, to] of skips.alias) out.set(from, to);
  return out;
}

/**
 * CEFR по частотности (задача 15.2): верхняя граница ранга для каждой ступени очищенного списка. Справочных
 * списков CEFR (PCIC, Profilo della lingua italiana) в открытом доступе в машинном виде нет, поэтому ступень
 * оценивается по рангу, а расхождение в одну ступень допускается: предметные слова (pasaporte, bagaglio) в учебниках
 * идут раньше, чем по частоте в текстах.
 */
export const CEFR_BANDS: { cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'; upTo: number }[] = [
  { cefr: 'A1', upTo: 800 },
  { cefr: 'A2', upTo: 1600 },
  { cefr: 'B1', upTo: 3200 },
  { cefr: 'B2', upTo: 6000 },
  { cefr: 'C1', upTo: Infinity },
];
const CEFR_ORDER = CEFR_BANDS.map((b) => b.cefr) as string[];

/** Ступень CEFR по рангу леммы. */
export const cefrOfRank = (rank: number) => CEFR_BANDS.find((b) => rank <= b.upTo)!.cefr;

/**
 * CEFR слова выше частотного больше чем на ступень (задача 15.2): «el balón» на уровне 7 стоял как C1. Обратное
 * не проверяется: частотные списки по текстам ставят бытовые слова (deporte, piscina, pasaporte) ниже, чем они
 * идут в учебниках, и A1 у них честнее B1. Не проверяются выражения (всегда C1), словосочетания (ранга нет),
 * тематические слова (редкие по определению) и слова вне списка. Ложные друзья проверяются: это обычные слова.
 */
export function cefrIssues<W extends { id: string; es: string; cefr: string; kind?: string; topical?: boolean }>(
  words: W[],
  rank: (es: string) => number | undefined,
): { id: string; msg: string; want: string }[] {
  const out: { id: string; msg: string; want: string }[] = [];
  for (const w of words) {
    if ((w.kind && w.kind !== 'false-friend') || w.topical) continue;
    const r = rank(w.es);
    if (r === undefined || r === Infinity) continue;
    const want = cefrOfRank(r);
    const d = CEFR_ORDER.indexOf(w.cefr) - CEFR_ORDER.indexOf(want);
    if (d > 1) out.push({ id: w.id, want, msg: `CEFR ${w.cefr}, по частотности ${want} (ранг ${r}): завышен больше чем на ступень` });
  }
  return out;
}

/** Поправка завышенного CEFR: на ступень выше частотной, не дальше — без лишних скачков. */
export const loweredCefr = (want: string) => CEFR_ORDER[CEFR_ORDER.indexOf(want) + 1];

/** Рискованные слова языка: `scripts/data/risky-<язык>.txt`, строки «лемма | грубое значение». */
export function parseRisky(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of text.split('\n')) {
    if (comment(l)) continue;
    const [lemma, why] = l.split('|').map((x) => x.trim());
    if (lemma) out.set(lemma, why ?? '');
  }
  return out;
}

/**
 * Слова с рискованной леммой (омоним с грубым значением, задача 15.2) должны быть помечены: пометка `usage`
 * и пояснение `usageNote`, чтобы игрок знал о втором значении.
 */
export function riskyIssues<W extends { id: string; es: string; usage?: string; usageNote?: string }>(
  words: W[],
  risky: Map<string, string>,
  lemmas: (text: string) => string[],
): { id: string; msg: string }[] {
  const out: { id: string; msg: string }[] = [];
  for (const w of words) {
    const hit = lemmas(w.es).find((l) => risky.has(l));
    if (hit && (!w.usage || !w.usageNote?.trim()))
      out.push({ id: w.id, msg: `рискованное слово «${hit}» (${risky.get(hit)}): нужна пометка usage и пояснение usageNote` });
  }
  return out;
}
