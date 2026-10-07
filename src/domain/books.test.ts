import { describe, expect, it } from 'vitest';
import { BOOK_XP, bookSlots, EMPTY_BOOKS, isBookWordId, parseBookId, readBook, textWords, unreadBooks } from './books';

const shards = (ch: number, n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${ch}:p${i}`, 1]));
const all = () => true;

describe('книги Летописца (задача 12.4)', () => {
  it('тексты открываются на 5, 10, 15 и 20 обрывках своей главы', () => {
    const open = (f: Record<string, number>, opened = 1) => bookSlots(opened, f, all).filter((s) => s.open).map((s) => s.id);
    expect(open({})).toEqual([]);
    expect(open(shards(1, 5))).toEqual(['book:1.1']);
    expect(open(shards(1, 14))).toEqual(['book:1.1', 'book:1.2']);
    expect(open({ ...shards(1, 20), ...shards(2, 5) }, 2)).toEqual(['book:1.1', 'book:1.2', 'book:1.3', 'book:1.4', 'book:2.1']);
    expect(bookSlots(2, {}, (id) => id.startsWith('book:1.')).map((s) => s.id)).toHaveLength(4);
  });
  it('непрочитанные; опыт только за первое понятое прочтение, лучший результат остаётся', () => {
    const slots = bookSlots(1, shards(1, 10), all);
    let { rec, xp } = readBook(EMPTY_BOOKS, 'book:1.1', 3, 100);
    expect(xp).toBe(0);
    expect(unreadBooks(slots, rec).map((s) => s.id)).toEqual(['book:1.2']);
    ({ rec, xp } = readBook(rec, 'book:1.1', 5, 200));
    expect(xp).toBe(BOOK_XP);
    ({ rec, xp } = readBook(rec, 'book:1.1', 2, 300));
    expect(xp).toBe(0);
    expect(rec.read['book:1.1']).toEqual({ at: 100, score: 5 });
  });
  it('id и счёт слов', () => {
    expect(isBookWordId('bk:1.vela')).toBe(true);
    expect(isBookWordId('cafe.te')).toBe(false);
    expect(parseBookId('book:3.2')).toEqual({ chapter: 3, n: 2 });
    expect(parseBookId('bk:3.2')).toBeNull();
    expect(textWords('Hola, ¿qué tal? — Bien. 5')).toBe(4);
  });
});
