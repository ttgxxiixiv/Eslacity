import { LESSON } from '../config';
import { LANG, LANGS, type Lang } from '../lang';

export type Verdict = 'correct' | 'almost' | 'wrong';

export interface CheckResult {
  verdict: Verdict;
  /** Каноническое написание, которое показываем пользователю. */
  expected: string;
  /** Причина ошибки, если её можно назвать. */
  reason?: 'article' | 'accent' | 'typo';
}

const PUNCT = /[¿¡?!.,;:"«»()…—–]/g;

/**
 * Регистр, пунктуация (включая ¿¡), лишние пробелы. Ударения сохраняются.
 * Апостроф остаётся (итальянское l'acqua); типографский ’ с телефонной клавиатуры приводится к '.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(PUNCT, ' ')
    // «l' acqua» → «l'acqua», но «un po' di» не трогаем.
    .replace(/(^|\s)(l|un|dell|all|dall|nell|sull|coll|quest|quell|c|d|m|t|s|v)'\s+/g, "$1$2'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Испанские и итальянские буквы с диакритикой.
const ACCENTS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u',
};

export function stripAccents(s: string): string {
  return s.replace(/[áéíóúüñàèìòù]/g, (c) => ACCENTS[c]);
}

/** Определённые артикли языка: единственное и множественное число. */
export function definiteArticles(lang: Lang = LANG): { singular: string[]; plural: string[] } {
  return { singular: LANGS[lang].singular, plural: LANGS[lang].plural };
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Разделяет "el café" на артикль и остаток. Артикля нет → article = null.
 * Итальянские l' и un' пишутся слитно: "l'acqua" → { article: "l'", core: "acqua" }.
 */
export function splitArticle(s: string, lang: Lang = LANG): { article: string | null; core: string } {
  const n = normalize(s);
  const info = LANGS[lang];
  const all = [...info.singular, ...info.plural, ...info.indefinite];
  for (const a of all) {
    if (a.endsWith("'") && n.startsWith(a) && n.length > a.length) return { article: a, core: n.slice(a.length) };
  }
  const sp = n.indexOf(' ');
  if (sp > 0 && all.includes(n.slice(0, sp))) {
    return { article: n.slice(0, sp), core: n.slice(sp + 1) };
  }
  return { article: null, core: n };
}

function checkOne(input: string, accepted: string): CheckResult {
  const n = normalize(input);
  const a = normalize(accepted);
  if (n === a) return { verdict: 'correct', expected: accepted };

  const exp = splitArticle(accepted);
  if (exp.article) {
    const got = splitArticle(input);
    if (got.article !== exp.article) return { verdict: 'wrong', expected: accepted, reason: 'article' };
  }

  if (stripAccents(n) === stripAccents(a)) return { verdict: 'almost', expected: accepted, reason: 'accent' };

  const letters = stripAccents(exp.core).replace(/ /g, '').length;
  if (letters >= LESSON.typoMinLength && levenshtein(n, a) === 1) {
    return { verdict: 'almost', expected: accepted, reason: 'typo' };
  }
  return { verdict: 'wrong', expected: accepted };
}

const RANK: Record<Verdict, number> = { correct: 2, almost: 1, wrong: 0 };

/**
 * Проверка ввода с клавиатуры. `accepted[0]` считается каноническим ответом.
 * Регистр и ¿¡ игнорируются. Без ударения или с одной опечаткой → «почти».
 * Неправильный или пропущенный артикль → неверно.
 */
export function checkTyped(input: string, accepted: string[]): CheckResult {
  let best: CheckResult = { verdict: 'wrong', expected: accepted[0] };
  if (!normalize(input)) return best;
  for (const acc of accepted) {
    const r = checkOne(input, acc);
    if (RANK[r.verdict] > RANK[best.verdict]) best = r;
    if (best.verdict === 'correct') break;
    // Причину «артикль» для канонического ответа держим, если ничего лучше нет.
    if (best.verdict === 'wrong' && !best.reason && r.reason) best = r;
  }
  return best;
}

/**
 * Буквы правильного ответа для кнопок над полем ввода: каждая по одному разу,
 * по алфавиту (порядок не подсказывает слово). Знаки препинания не нужны: проверка их не учитывает.
 */
export function answerLetters(answer: string, lang: Lang = LANG): { letters: string[]; space: boolean } {
  const s = normalize(answer);
  const letters = [...new Set(s.match(/\p{L}/gu) ?? [])].sort((a, b) => a.localeCompare(b, LANGS[lang].locale));
  // Апостроф нужен для итальянских l'acqua, un'amica.
  if (s.includes("'")) letters.push("'");
  return { letters, space: s.includes(' ') };
}
