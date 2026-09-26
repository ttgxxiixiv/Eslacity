/**
 * Реплика сцены по словам: слова можно нажать, между ними — пробелы и знаки. Слово — буквы с апострофом
 * элизии на конце, как в словаре курса (`d'acqua` → `d'` и `acqua`), ключ перевода — строчными.
 */
export type ScenePiece = { word: string; key: string } | { text: string };

const WORD = /([A-Za-zÀ-ÖØ-öø-ÿ]+'?)/;

export function sceneWords(line: string): ScenePiece[] {
  return line
    .replace(/[’`]/g, "'")
    .split(WORD)
    .filter(Boolean)
    .map((p) => (WORD.test(p) && /^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(p) ? { word: p, key: p.toLowerCase() } : { text: p }));
}

/** Перевод слова сцены: сначала перевод автора сцены, потом словарь курса. */
export function wordTranslation(key: string, gloss: Record<string, string> | undefined, auto: Record<string, string> | undefined): string | undefined {
  return gloss?.[key] ?? auto?.[key];
}
