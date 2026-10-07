import { describe, expect, it } from 'vitest';
import { dayKey } from './srs';
import { EMPTY_THREAD, fragmentsOf, noteDue, noteOf, openThread, parseThreadId, shardsToday, threadDue } from './thread';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 7, 18).getTime();
const all = () => true;
/** `n` обрывков главы `ch`, полученных в `ts`. */
const shards = (ch: number, n: number, ts = NOW - 3 * DAY) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${ch}:p${i}`, ts]));

describe('нить главы (задача 13.1)', () => {
  it('сцены открываются при открытии главы, на 10 и на 20 обрывках', () => {
    expect(openThread(1, {}, all)).toEqual(['th:1.open']);
    expect(openThread(1, shards(1, 9), all)).toEqual(['th:1.open']);
    expect(openThread(1, shards(1, 10), all)).toEqual(['th:1.open', 'th:1.half']);
    expect(openThread(2, { ...shards(1, 20), ...shards(2, 3) }, all)).toEqual(['th:1.open', 'th:1.half', 'th:1.climax', 'th:2.open']);
    expect(fragmentsOf({ ...shards(1, 4), ...shards(2, 2) }, 2)).toBe(2);
  });
  it('нет сцены в контенте — её нет и в нити; прочитанные не ждут', () => {
    const only1 = (id: string) => id.startsWith('th:1.');
    expect(openThread(2, shards(1, 20), only1)).toEqual(['th:1.open', 'th:1.half', 'th:1.climax']);
    expect(threadDue(1, shards(1, 10), { seen: { 'th:1.open': NOW } }, all)).toEqual(['th:1.half']);
  });
  it('записка ждёт, если сегодня добыт обрывок, и только раз в день', () => {
    const today = { ...shards(1, 2), '1:cafe': NOW - 60_000 };
    expect(shardsToday(today, NOW)).toBe(1);
    expect(noteDue(shards(1, 2), EMPTY_THREAD, NOW)).toBe(false);
    expect(noteDue(today, EMPTY_THREAD, NOW)).toBe(true);
    expect(noteDue(today, { seen: {}, note: dayKey(NOW) }, NOW)).toBe(false);
  });
  it('записка дня — из открытой главы или ближайшей прошлой, меняется по дням', () => {
    const notes = { '1': [{ es: 'a', ru: 'а' }, { es: 'b', ru: 'б' }] };
    const a = noteOf(notes, 1, NOW)!;
    expect(noteOf(notes, 1, NOW + DAY)!.es).not.toBe(a.es);
    expect(noteOf(notes, 3, NOW)).toEqual(a);
    expect(noteOf({}, 1, NOW)).toBeNull();
  });
  it('разбор id', () => {
    expect(parseThreadId('th:2.climax')).toEqual({ chapter: 2, trigger: 'climax' });
    expect(parseThreadId('th:2.end')).toBeNull();
    expect(parseThreadId('sc:cafe.1')).toBeNull();
  });
});
