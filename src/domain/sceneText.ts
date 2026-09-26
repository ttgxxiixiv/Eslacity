/**
 * Реплика сцены по словам: слова можно нажать, между ними — пробелы и знаки. Слово — буквы с апострофом
 * элизии на конце, как в словаре курса (`d'acqua` → `d'` и `acqua`), ключ перевода — строчными.
 * Знаки, которые стоят вплотную к слову («¿», «?», «,»), идут вместе с ним в `pre` и `post`,
 * чтобы при переносе строки знак не отрывался от слова.
 */
export type ScenePiece = { word: string; key: string; pre?: string; post?: string } | { text: string };

const WORD = /([A-Za-zÀ-ÖØ-öø-ÿ]+'?)/;

export function sceneWords(line: string): ScenePiece[] {
  const raw = line
    .replace(/[’`]/g, "'")
    .split(WORD)
    .filter(Boolean)
    .map((p) => (WORD.test(p) && /^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(p) ? { word: p, key: p.toLowerCase() } : { text: p }));
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

/** Перевод слова сцены: сначала перевод автора сцены, потом словарь курса. */
export function wordTranslation(key: string, gloss: Record<string, string> | undefined, auto: Record<string, string> | undefined): string | undefined {
  return gloss?.[key] ?? auto?.[key];
}
