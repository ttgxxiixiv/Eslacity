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
