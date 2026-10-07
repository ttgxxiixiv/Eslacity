/**
 * Вычитка контента носителем (задачи 11.2 и 11.3): общие части выгрузки и загрузки.
 *
 * Строка выгрузки — одна строка контента на изучаемом языке с точным адресом: файл (от `src/content/<язык>/`)
 * и путь внутри JSON (`words/3/example/es`). Носитель вписывает правку в колонку `fix`, загрузка находит строку
 * по адресу и сверяет старый текст: если он уже изменился, правка не применяется.
 */

export interface ReviewRow {
  /** Вид контента: файл CSV, куда попадает строка. */
  type: ReviewType;
  file: string;
  /** Путь внутри JSON через «/»: ключи и номера. */
  path: string;
  /** id ближайшего объекта с id (слово, фраза, упражнение, сцена) — чтобы найти место глазами. */
  id: string;
  /** Уровень: CEFR слова, глава, район урока — по нему удобно идти от сложного. */
  level: string;
  /** Перевод или пояснение рядом: что эта строка должна значить. */
  ru: string;
  text: string;
}

export type ReviewType = 'words' | 'phrases' | 'scenes' | 'missions' | 'grammar' | 'sphinx' | 'letters' | 'people' | 'verbs' | 'pairs' | 'books';

export const REVIEW_TYPES: ReviewType[] = ['words', 'phrases', 'scenes', 'missions', 'grammar', 'sphinx', 'letters', 'people', 'verbs', 'pairs', 'books'];

export const CSV_COLUMNS = ['file', 'path', 'id', 'level', 'ru', 'text', 'fix', 'comment'] as const;

/**
 * Поля, где лежит текст на изучаемом языке. В грамматике в `prompt`, `statement`, `explain` и в теории (`md`)
 * русский текст вперемешку с испанскими или итальянскими примерами: их носитель тоже проверяет.
 */
const TARGET_KEYS = new Set([
  'es', 'latam', 'sample', 'sentence', 'statement', 'prompt', 'explain', 'md', 'source', 'keyword', 'text', 'first', 'second', 'connector', 'answer',
  'alt', 'extra', 'options', 'answers', 'examples', 'forms', 'yo', 'fut', 'pp', 'inf',
]);
/** Ветки, где строки русские или служебные: вопросы на понимание, переводы слов (`gloss`), облик и голос. */
const SKIP_KEYS = new Set(['ru', 'gloss', 'auto', 'look', 'voice', 'questions', 'task', 'label', 'role', 'character', 'errands', 'name', 'names', 'about', 'hint']);

/** Вид контента по файлу и пути: у праздника в одном файле слова, фразы и миссия. */
export function typeOf(file: string, path: string): ReviewType | null {
  const dir = file.split('/')[0];
  if (dir === 'festivals') {
    const head = path.split('/')[0];
    return head === 'words' ? 'words' : head === 'phrases' ? 'phrases' : head === 'missions' ? 'missions' : head === 'intro' ? 'people' : null;
  }
  const byDir: Record<string, ReviewType> = { words: 'words', scrolls: 'words', phrases: 'phrases', scenes: 'scenes', missions: 'missions', grammar: 'grammar', books: 'books' };
  if (byDir[dir]) return byDir[dir];
  const byFile: Record<string, ReviewType> = {
    'sphinx.json': 'sphinx', 'letters.json': 'letters', 'npcs.json': 'people', 'chronicler.json': 'people', 'guardians.json': 'people', 'verbs.json': 'verbs', 'pairs.json': 'pairs',
  };
  return byFile[file] ?? null;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Строки на изучаемом языке из файла контента, с адресом и ближайшим переводом. */
export function extractRows(file: string, data: Json): ReviewRow[] {
  const out: ReviewRow[] = [];
  const walk = (v: Json, path: string[], ctx: { id: string; level: string; ru: string }, target: boolean) => {
    if (typeof v === 'string') {
      if (!target || !v.trim()) return;
      // Русский текст без единого слова на латинице (теория, пояснение, вариант-толкование) носителю проверять нечего.
      if (/[а-яё]/i.test(v) && !/[a-zà-ÿñ]{2,}/i.test(v)) return;
      const p = path.join('/');
      const type = typeOf(file, p);
      if (type) out.push({ type, file, path: p, id: ctx.id, level: ctx.level, ru: ctx.ru, text: v });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, [...path, String(i)], ctx, target));
      return;
    }
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, Json>;
    const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
    const level = str('cefr') || (typeof o.chapter === 'number' ? `глава ${o.chapter}` : '') || str('district') || (typeof o.level === 'number' ? `уровень ${o.level}` : '') || ctx.level;
    const example = o.example && typeof o.example === 'object' && !Array.isArray(o.example) ? (o.example as Record<string, Json>) : null;
    const next = { id: str('id') || ctx.id, level, ru: str('ru') || ctx.ru };
    for (const [k, x] of Object.entries(o)) {
      if (SKIP_KEYS.has(k)) continue;
      // У примера слова свой перевод; у полей самого слова — перевод слова.
      const ru = k === 'example' && example && typeof example.ru === 'string' ? example.ru : next.ru;
      // Заголовок — на изучаемом языке только у текстов мудрости Сфинкса; у уроков, писем и пар он русский.
      const own = TARGET_KEYS.has(k) || k === 'fem' || (k === 'title' && file === 'sphinx.json');
      walk(x, [...path, k], { ...next, ru }, target || own);
    }
  };
  // Числовой ответ (номер варианта) — не строка и в выгрузку не попадает; строковый `answer` у ввода — попадает.
  walk(data, [], { id: '', level: '', ru: '' }, false);
  return out;
}

const quote = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV с BOM (Excel открывает UTF-8 только с ним), разделитель — запятая, строки с запятыми и кавычками в кавычках. */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(quote).join(',')).join('\r\n') + '\r\n';
}

/** Разбор CSV: кавычки, удвоенные кавычки, переводы строк внутри поля, BOM, `;` вместо `,` (русский Excel). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const firstLine = s.slice(0, s.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Значение по адресу строки выгрузки: `words/3/example/es`. */
export function getAt(data: unknown, path: string): unknown {
  return path.split('/').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), data);
}

/** Записать значение по адресу; адрес должен существовать (новые поля правкой не создаются). */
export function setAt(data: unknown, path: string, value: string): boolean {
  const keys = path.split('/');
  const last = keys.pop()!;
  const parent = getAt(data, keys.join('/'));
  if (!parent || typeof parent !== 'object' || !(last in (parent as object))) return false;
  (parent as Record<string, unknown>)[last] = value;
  return true;
}

/**
 * Где в тексте файла стоит каждая строка-значение: адрес (как в выгрузке) → начало и конец вместе с кавычками.
 * Загрузка правок меняет только эти символы: остальной файл и его форматирование не трогаются (файлы контента
 * отформатированы по-разному, перезапись целиком дала бы огромный дифф).
 */
export function locateStrings(text: string): Map<string, [number, number]> {
  const spans = new Map<string, [number, number]>();
  let i = 0;
  const ws = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  const str = (): [number, number] => {
    const start = i;
    i++; // "
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++;
    return [start, i];
  };
  const value = (path: string[]): void => {
    ws();
    const ch = text[i];
    if (ch === '"') spans.set(path.join('/'), str());
    else if (ch === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return;
      }
      for (;;) {
        ws();
        const [a, b] = str();
        const key = JSON.parse(text.slice(a, b)) as string;
        ws();
        i++; // :
        value([...path, key]);
        ws();
        if (text[i++] === '}') return;
      }
    } else if (ch === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (let n = 0; ; n++) {
        value([...path, String(n)]);
        ws();
        if (text[i++] === ']') return;
      }
    } else {
      while (i < text.length && !/[\s,\]}]/.test(text[i])) i++;
    }
  };
  value([]);
  return spans;
}

export interface ReviewFix {
  file: string;
  path: string;
  /** Текст, который видел носитель: если в контенте уже другой, правка не применяется. */
  text: string;
  fix: string;
  comment: string;
}

export type FixResult =
  | { ok: true; fix: ReviewFix }
  | { ok: false; fix: ReviewFix; reason: 'нет такой строки' | 'текст уже изменился' | 'правка совпадает с текстом' };

/** Применить правки к тексту одного файла. Возвращает новый текст и итог по каждой правке. */
export function applyFixes(text: string, fixes: ReviewFix[]): { text: string; results: FixResult[] } {
  const spans = locateStrings(text);
  const results: FixResult[] = [];
  const edits: { at: [number, number]; to: string }[] = [];
  for (const f of fixes) {
    const at = spans.get(f.path);
    if (!at) results.push({ ok: false, fix: f, reason: 'нет такой строки' });
    else if (JSON.parse(text.slice(at[0], at[1])) !== f.text) results.push({ ok: false, fix: f, reason: 'текст уже изменился' });
    else if (f.fix === f.text) results.push({ ok: false, fix: f, reason: 'правка совпадает с текстом' });
    else {
      edits.push({ at, to: JSON.stringify(f.fix) });
      results.push({ ok: true, fix: f });
    }
  }
  // С конца файла: замена не сдвигает места ещё не применённых правок.
  let out = text;
  for (const e of edits.sort((a, b) => b.at[0] - a.at[0])) out = out.slice(0, e.at[0]) + e.to + out.slice(e.at[1]);
  return { text: out, results };
}

/** Правки из CSV выгрузки: строки с непустым `fix`. Пробелы по краям носитель мог оставить случайно. */
export function fixesFromCsv(csv: string): ReviewFix[] {
  const [head, ...rows] = parseCsv(csv);
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name);
  const [file, path, text, fix, comment] = ['file', 'path', 'text', 'fix', 'comment'].map(col);
  if ([file, path, text, fix].some((c) => c < 0)) throw new Error('в таблице нет колонок file, path, text и fix: это не выгрузка на вычитку');
  return rows
    .filter((r) => (r[fix] ?? '').trim())
    .map((r) => ({ file: r[file], path: r[path], text: r[text], fix: r[fix].trim(), comment: comment >= 0 ? (r[comment] ?? '').trim() : '' }));
}
