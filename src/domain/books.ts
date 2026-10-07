import { fragmentsOf } from './thread';

/**
 * Книги Летописца (задача 12.4): связное чтение по главам. У главы четыре текста — истории мира до карты, дневник
 * прежнего путника, письма. Текст открывается по обрывкам главы (5, 10, 15, 20), после него пять вопросов
 * на понимание. Новые слова текста можно взять «в мои слова»: карточка `bk:<глава>.<slug>` уходит в повторение.
 */

export const BOOK_WORD_PREFIX = 'bk:';
/** Слово книг Летописца: `bk:1.vela`. Книги главы грузятся как «место» `bk:1`. */
export const isBookWordId = (id: string): boolean => id.startsWith(BOOK_WORD_PREFIX);
export const bookSource = (chapter: number) => `bk:${chapter}` as const;

export const BOOKS_PER_CHAPTER = 4;
/** Сколько обрывков главы открывает текст с номером n (с единицы). */
export const bookAt = (n: number) => n * 5;
export const bookId = (chapter: number, n: number) => `book:${chapter}.${n}`;

export function parseBookId(id: string): { chapter: number; n: number } | null {
  const m = id.match(/^book:(\d+)\.(\d+)$/);
  return m ? { chapter: Number(m[1]), n: Number(m[2]) } : null;
}

/** Объём текста главы в словах: чем дальше, тем длиннее. */
export const BOOK_WORDS: Record<number, [number, number]> = { 1: [120, 180], 2: [200, 300], 3: [300, 450], 4: [400, 600], 5: [400, 600] };
/** Незнакомых слов к уровню главы не больше (строже сцен), остальные переведены. */
export const BOOK_UNKNOWN_MAX = 0.03;
export const BOOK_QUESTIONS = 5;
/** Главы, у которых книги уже написаны: валидатор требует у них все четыре текста. Растёт по главе за версию. */
export const BOOK_CHAPTERS = [1, 2, 3, 4];

/** Опыт за первое прочтение, если понято не меньше четырёх ответов из пяти. */
export const BOOK_XP = 30;
export const BOOK_PASS = 4;

export interface BooksRecord {
  /** id текста → когда прочитан и сколько вопросов понято (лучший результат). */
  read: Record<string, { at: number; score: number }>;
}
export const EMPTY_BOOKS: BooksRecord = { read: {} };

export interface BookSlot {
  id: string;
  chapter: number;
  n: number;
  /** Обрывков главы, чтобы открыть. */
  at: number;
  open: boolean;
}

/** Тексты глав до открытой включительно: открыт ли каждый по обрывкам его главы. `exists` — есть ли текст в контенте. */
export function bookSlots(opened: number, fragments: Record<string, number>, exists: (id: string) => boolean): BookSlot[] {
  const out: BookSlot[] = [];
  for (let ch = 1; ch <= opened; ch++) {
    const got = fragmentsOf(fragments, ch);
    for (let n = 1; n <= BOOKS_PER_CHAPTER; n++) {
      const id = bookId(ch, n);
      if (exists(id)) out.push({ id, chapter: ch, n, at: bookAt(n), open: got >= bookAt(n) });
    }
  }
  return out;
}

/** Открытые и ещё не прочитанные тексты: для бейджа Летописи. */
export const unreadBooks = (slots: BookSlot[], rec: BooksRecord) => slots.filter((s) => s.open && !rec.read[s.id]);

/** Число слов текста: так же считаются слова писем. */
export function textWords(text: string): number {
  return text.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

/** Запись прочтения: лучший результат остаётся. Опыт — только за первое прочтение, где понято достаточно. */
export function readBook(rec: BooksRecord, id: string, score: number, now: number): { rec: BooksRecord; xp: number } {
  const prev = rec.read[id];
  const first = !prev || prev.score < BOOK_PASS;
  const xp = first && score >= BOOK_PASS ? BOOK_XP : 0;
  return { rec: { read: { ...rec.read, [id]: { at: prev?.at ?? now, score: Math.max(score, prev?.score ?? 0) } } }, xp };
}
