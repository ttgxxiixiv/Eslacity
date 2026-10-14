/**
 * Реплика сцены по словам: слова можно нажать, между ними — пробелы и знаки. Слово — буквы с апострофом
 * элизии на конце, как в словаре курса (`d'acqua` → `d'` и `acqua`), ключ перевода — строчными.
 * Знаки, которые стоят вплотную к слову («¿», «?», «,»), идут вместе с ним в `pre` и `post`,
 * чтобы при переносе строки знак не отрывался от слова.
 */
import { LANG, LANGS, type Lang } from '../lang';
import { lowerText } from './answer';

export type ScenePiece = { word: string; key: string; pre?: string; post?: string } | { text: string };

// Любые буквы: у турецкого есть ı, ğ, ş и İ, которых нет в латинице с диакритикой. Аффикс после апострофа
// (Kerem'i) — часть слова, если так у языка (`apostropheSuffix` в профиле).
const wordPattern = (lang: Lang) => (LANGS[lang].apostropheSuffix ? /(\p{L}+(?:'\p{L}+)?)/u : /(\p{L}+'?)/u);
const keyOf = (w: string, lang: Lang) => LANGS[lang].wordKey?.(w) ?? lowerText(w, lang);

/** `lang` — язык текста: валидатор проверяет все курсы в одном запуске, приложение — язык курса. */
export function sceneWords(line: string, lang: Lang = LANG): ScenePiece[] {
  const WORD = wordPattern(lang);
  const raw = line
    .replace(/[’`]/g, "'")
    .split(WORD)
    .filter(Boolean)
    .map((p) => (WORD.test(p) && /^\p{L}/u.test(p) ? { word: p, key: keyOf(p, lang) } : { text: p }));
  const out: ScenePiece[] = [];
  raw.forEach((p, i) => {
    if ('word' in p) {
      out.push(p);
      return;
    }
    let text = p.text;
    const prev = out[out.length - 1];
    // Знаки сразу после слова — к этому слову.
    const lead = text.match(/^\S+/)?.[0];
    if (lead && prev && 'word' in prev) {
      prev.post = (prev.post ?? '') + lead;
      text = text.slice(lead.length);
    }
    // Знаки сразу перед словом — к следующему слову.
    const next = raw[i + 1];
    const tail = text.match(/\S+$/)?.[0];
    if (tail && next && 'word' in next) {
      (next as { pre?: string }).pre = tail;
      text = text.slice(0, -tail.length);
    }
    if (text) out.push({ text });
  });
  return out;
}

type SceneWord = Extract<ScenePiece, { word: string }>;

/**
 * Реплика кусками для вывода: пробелы отдельно, слова — группами, которые не переносятся.
 * Слово с апострофом элизии держится вместе со следующим: «l'» и «impossibile» не расходятся по строкам.
 */
export function sceneChunks(line: string): ({ text: string } | { words: SceneWord[] })[] {
  const out: ({ text: string } | { words: SceneWord[] })[] = [];
  for (const p of sceneWords(line)) {
    const last = out[out.length - 1];
    if (!('word' in p)) out.push(p);
    else if (last && 'words' in last && last.words[last.words.length - 1].word.endsWith("'")) last.words.push(p);
    else out.push({ words: [p] });
  }
  return out;
}

/** Перевод слова сцены: сначала перевод автора сцены, потом словарь курса. */
export function wordTranslation(key: string, gloss: Record<string, string> | undefined, auto: Record<string, string> | undefined): string | undefined {
  return gloss?.[key] ?? auto?.[key];
}
