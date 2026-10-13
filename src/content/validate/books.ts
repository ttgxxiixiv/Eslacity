import { normalize } from '../../domain/answer';
import { CHAPTERS as PLAN } from '../vocabPlan';
import { sceneWords } from '../../domain/sceneText';
import { BOOK_QUESTIONS, BOOK_UNKNOWN_MAX, BOOK_WORD_PREFIX, BOOK_WORDS, BOOKS_PER_CHAPTER, bookId, parseBookId, textWords } from '../../domain/books';
import type { BookFile } from '../schema';
import { type Issue, empty } from './common';

/** Книги Летописца. */

export interface BookChecks {
  /** Слова текста: всего и незнакомые к уровню главы (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
  /** Главы, у которых книги уже написаны: у каждой все четыре текста. */
  chapters: number[];
  /** Есть ли у существительных род (`gender` профиля языка): у английского нет, и `gender` у слова — ошибка. */
  gender?: boolean;
}

/**
 * Книги Летописца (задача 12.4): `books/<глава>.json`. Четыре текста `book:<глава>.<n>` объёмом по главе
 * (`BOOK_WORDS`), пять вопросов на понимание, незнакомых слов не больше 3%. Каждое незнакомое слово — в словарике
 * книг (`words`, его `forms`) или в `gloss`. Слово словарика — `bk:<глава>.<slug>` уровня главы с примером.
 */
export function validateBooks(files: { name: string; data: BookFile }[], checks: BookChecks): Issue[] {
  const out: Issue[] = [];
  const seenChapters = new Set<number>();
  for (const { name, data } of files) {
    const where = `books/${name}`;
    const ch = data.chapter;
    const plan = PLAN[ch - 1];
    if (`${ch}.json` !== name || !plan) {
      out.push({ level: 'error', where, msg: `глава ${ch} не совпадает с именем файла` });
      continue;
    }
    seenChapters.add(ch);
    const level = Math.max(...plan.levels);
    const [minWords, maxWords] = BOOK_WORDS[ch] ?? [0, Infinity];
    const keysOf = (text: string) => sceneWords(text).flatMap((p) => ('key' in p ? [normalize(p.key)] : []));
    // Словарик главы: формы слов в текстах.
    const forms = new Map<string, string>();
    const ids = new Set<string>();
    for (const w of data.words ?? []) {
      const at = `${where} ${w.id ?? '?'}`;
      if (!w.id?.startsWith(`${BOOK_WORD_PREFIX}${ch}.`)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${BOOK_WORD_PREFIX}${ch}."` });
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(w.id);
      if (empty(w.es) || empty(w.ru)) out.push({ level: 'error', where: at, msg: 'пустое слово или перевод' });
      if (w.level !== level) out.push({ level: 'error', where: at, msg: `уровень ${w.level}, у главы ${ch} — ${level}` });
      if (w.cefr !== plan.cefr) out.push({ level: 'error', where: at, msg: `CEFR ${w.cefr}, у главы — ${plan.cefr}` });
      if (w.pos === 'noun' && checks.gender !== false && !w.gender) out.push({ level: 'error', where: at, msg: 'у существительного нет рода' });
      if (checks.gender === false && w.gender) out.push({ level: 'error', where: at, msg: 'род у слова языка без рода' });
      if (empty(w.example?.es) || empty(w.example?.ru)) out.push({ level: 'error', where: at, msg: 'нет примера' });
      if (!w.forms?.length) out.push({ level: 'error', where: at, msg: 'нет форм в текстах (forms)' });
      for (const f of w.forms ?? []) forms.set(normalize(f), w.id);
    }
    const textKeys = new Set<string>();
    const bookIds = new Set<string>();
    for (const b of data.books ?? []) {
      const at = `${where} ${b.id ?? '?'}`;
      const n = parseBookId(b.id ?? '');
      if (!n || n.chapter !== ch || n.n < 1 || n.n > BOOKS_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `id должен быть "book:${ch}.<1–${BOOKS_PER_CHAPTER}>"` });
      if (bookIds.has(b.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      bookIds.add(b.id);
      if (empty(b.title?.es) || empty(b.title?.ru)) out.push({ level: 'error', where: at, msg: 'нет заголовка или его перевода' });
      const paras = b.paragraphs ?? [];
      if (!paras.length || paras.some((p) => empty(p.es) || empty(p.ru))) out.push({ level: 'error', where: at, msg: 'пустой абзац или перевод' });
      const text = paras.map((p) => p.es).join(' ');
      const count = textWords(text);
      if (count < minWords || count > maxWords) out.push({ level: 'error', where: at, msg: `${count} слов, в главе ${ch} нужно ${minWords}–${maxWords}` });
      const keys = new Set(keysOf(`${b.title?.es ?? ''} ${text}`));
      for (const k of keys) textKeys.add(k);
      const qs = b.questions ?? [];
      if (qs.length !== BOOK_QUESTIONS) out.push({ level: 'error', where: at, msg: `вопросов ${qs.length}, нужно ${BOOK_QUESTIONS}` });
      qs.forEach((q, i) => {
        const opts = q.options ?? [];
        if (empty(q.q)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'пустой вопрос' });
        if (opts.length < 2 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'нужно 2–4 разных варианта' });
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `ответ ${q.answer}` });
      });
      const gloss = new Map(Object.entries(b.gloss ?? {}).map(([k, v]) => [normalize(k), v]));
      for (const [k, v] of gloss) {
        if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
        if (!keys.has(k)) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в тексте` });
      }
      if (checks.coverage) {
        const cov = checks.coverage(`${b.title?.es ?? ''} ${text}`, level);
        const share = cov.total ? cov.unknown.length / cov.total : 0;
        if (share > BOOK_UNKNOWN_MAX) {
          out.push({ level: 'error', where: at, msg: `незнакомых слов ${(share * 100).toFixed(1)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${BOOK_UNKNOWN_MAX * 100}%` });
        }
        const bare = [...new Set(cov.unknown)].filter((t) => !gloss.has(normalize(t)) && !forms.has(normalize(t)));
        if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level}, в словарике книг и в gloss: ${bare.join(', ')}` });
      }
    }
    for (const [f, id] of forms) if (!textKeys.has(f)) out.push({ level: 'warning', where: `${where} ${id}`, msg: `формы "${f}" нет в текстах главы` });
    if (checks.chapters.includes(ch)) {
      for (let n = 1; n <= BOOKS_PER_CHAPTER; n++) if (!bookIds.has(bookId(ch, n))) out.push({ level: 'error', where, msg: `нет текста ${bookId(ch, n)}` });
    }
  }
  for (const ch of checks.chapters) if (!seenChapters.has(ch)) out.push({ level: 'error', where: `books/${ch}.json`, msg: `нет книг главы ${ch}` });
  return out;
}
