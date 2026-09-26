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
  exercises: ({ kind: 'choose'; prompt: string; options: string[] } | { kind: 'gap'; sentence: string; options: string[] } | { kind: 'truefalse'; statement: string })[];
}

type Lem = (s: string) => string[];

/** Что учит грамматика: формы из таблиц и вариантов ответа уроков. */
export function grammarLemmas(lessons: LessonText[], lem: Lem): Set<string> {
  return new Set(
    lessons.flatMap((l) => [
      ...l.theory.flatMap((b) => (b.kind === 'table' ? b.rows.flatMap((r) => r.cells.flatMap(lem)) : [])),
      ...l.exercises.flatMap((e) => ('options' in e ? e.options.flatMap(lem) : [])),
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
      ...l.exercises.flatMap((e) => lem(e.kind === 'choose' ? e.prompt : e.kind === 'gap' ? e.sentence : e.statement)),
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
export function uncoveredWords(text: string, level: number, lex: Lexicon, forms: Map<string, string>, lang: string): string[] {
  const out: string[] = [];
  for (const t of tokens(text)) {
    const l = lemmaOf(t, forms, lang);
    const stem = stemOf(t);
    const verb = knownVerb(t, level, lex.verbLevel);
    const known =
      (lex.wordLevel.get(l) ?? Infinity) <= level ||
      (lex.stemLevel.get(stem) ?? Infinity) <= level ||
      verb ||
      lex.grammar.has(l) ||
      (lex.service.has(l) && lex.anywhere.has(l));
    if (!known && !out.includes(t)) out.push(t);
  }
  return out;
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
