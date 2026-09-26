/**
 * Фразы мест: необязательные слова в скобках. «(Yo) quiero un café» — верно и с «yo», и без него.
 * Скобки не вкладываются, групп в фразе немного, поэтому варианты перечисляются полностью.
 */

export const PHRASE_PREFIX = 'ph:';
/** Фраза длиннее этого числа слов (в самом длинном варианте) — уже не фраза, а текст. */
export const PHRASE_MAX_WORDS = 12;

const GROUP = /\(([^()]*)\)/g;
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').replace(/([¿¡])\s+/g, '$1').trim();

/** Ошибка разметки скобок или null: пустые, вложенные, незакрытые скобки, вся фраза в скобках. */
export function optionalError(text: string): string | null {
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth > 1) return 'вложенные скобки';
    if (depth < 0) return 'лишняя закрывающая скобка';
  }
  if (depth) return 'незакрытая скобка';
  for (const m of text.matchAll(GROUP)) if (!m[1].trim()) return 'пустые скобки';
  if (!clean(text.replace(GROUP, ' ')).replace(/[¿¡?!.,;:]/g, '').trim()) return 'вся фраза в скобках';
  return null;
}

/** Все варианты фразы: каждая группа в скобках то есть, то нет. Полный вариант первый. */
export function expandOptional(text: string): string[] {
  const parts = text.split(GROUP);
  // parts: текст, группа, текст, группа, … — группы на нечётных местах.
  let out = [''];
  parts.forEach((p, i) => {
    out = i % 2 ? out.flatMap((s) => [`${s} ${p} `, s]) : out.map((s) => s + p);
  });
  return [...new Set(out.map(clean))];
}

/** Фраза без скобок, как её показать целиком: «Yo quiero un café». */
export const fullPhrase = (text: string) => expandOptional(text)[0];

/** Число слов в самом длинном варианте. */
export const phraseWords = (text: string) => fullPhrase(text).split(' ').filter((w) => /[\p{L}\d]/u.test(w)).length;
