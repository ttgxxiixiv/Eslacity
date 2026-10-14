import { LANG_IDS } from '../../lang';
import { normalize } from '../../domain/answer';
import { sceneWords } from '../../domain/sceneText';
import { SPHINX_LEVEL, SPHINX_UNKNOWN_MAX, type SphinxChecks } from './sphinx';

/** Общее для проверок контента: вид замечания, части речи и CEFR, счёт слов, проверки переводов незнакомых слов (gloss), доли незнакомых и вариантов ответа. */

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  msg: string;
}

export const POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'interj', 'phrase']);

export const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);

export const empty = (v: unknown) => typeof v !== 'string' || v.trim() === '';

/** Число слов в строке. */
export const wordCount = (s: string) => s.trim().split(/\s+/).length;

/**
 * Ключи слов, которые можно нажать в тексте. Валидатор проверяет все курсы в одном запуске, а слова у языков
 * режутся по-разному (турецкое «Kerem'i» — одно слово с ключом kerem, итальянское «d'acqua» — два), поэтому
 * берутся ключи по правилам всех профилей: проверке «слово из gloss есть в тексте» этого хватает.
 */
export const textKeys = (text: string): string[] =>
  LANG_IDS.flatMap((l) => sceneWords(text, l).flatMap((p) => ('key' in p ? [normalize(p.key)] : [])));

/** Слова, которые можно нажать в тексте, и проверка `gloss`: пустой перевод — ошибка, слова нет в тексте — предупреждение. */
export function glossIssues(texts: string[], glossIn: Record<string, string> | undefined, at: string, out: Issue[]): Record<string, string> {
  const keys = new Set(texts.flatMap(textKeys));
  const gloss = Object.fromEntries(Object.entries(glossIn ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const [k, v] of Object.entries(gloss)) {
    if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
    if (!keys.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в тексте` });
  }
  return gloss;
}

/** Незнакомые слова текста к уровню 7: не больше 7%, и каждое переведено в `gloss`. */
export function coverageIssues(text: string, gloss: Record<string, string>, at: string, checks: SphinxChecks, out: Issue[]) {
  if (!checks.coverage) return;
  const cov = checks.coverage(text, SPHINX_LEVEL);
  const share = cov.total ? cov.unknown.length / cov.total : 0;
  if (share > SPHINX_UNKNOWN_MAX) {
    out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${SPHINX_UNKNOWN_MAX * 100}%` });
  }
  const bare = [...new Set(cov.unknown)].filter((t) => !gloss[t]);
  if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре до уровня ${SPHINX_LEVEL} и в gloss: ${bare.join(', ')}` });
}

/** Варианты вопроса на понимание: 3–4 разных, ответ среди них. */
export function optionIssues(q: { q: string; options: string[]; answer: number }, w: string, out: Issue[]) {
  const opts = q.options ?? [];
  if (empty(q.q)) out.push({ level: 'error', where: w, msg: 'пустой вопрос' });
  if (opts.length < 3 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) out.push({ level: 'error', where: w, msg: 'нужно 3–4 разных варианта' });
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: w, msg: `ответ ${q.answer}` });
}
