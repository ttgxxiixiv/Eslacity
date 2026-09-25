import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

const T = 1_700_000_000_000;
const DAY = 86_400_000;

describe('база версии 2', () => {
  it('открывает базу версии 1 без потерь и добавляет журнал', async () => {
    // База в том виде, в каком она была до журнала ответов.
    const old = new Dexie('eslacity');
    old.version(1).stores({ cards: 'wordId, due', buildings: 'locationId', grammar: 'lessonId', days: 'date', meta: 'key' });
    await old.table('cards').put({ wordId: 'cafe.te', ef: 2.5, interval: 6, reps: 2, due: 100, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
    await old.table('meta').put({ key: 'coins', value: 77 });
    await old.table('grammar').put({ lessonId: 'a1.02-ser', completedAt: 1, bestScore: 90 });
    old.close();

    const { db } = await import('./db');
    expect(await db.cards.get('cafe.te')).toMatchObject({ interval: 6, due: 100 });
    expect((await db.meta.get('coins'))?.value).toBe(77);
    expect(await db.grammar.get('a1.02-ser')).toMatchObject({ bestScore: 90 });
    expect(await db.answers.count()).toBe(0);
    expect(db.verno).toBe(2);
  });

  it('чистка убирает записи старше 90 дней и лишние сверх лимита', async () => {
    const { db } = await import('./db');
    const { pruneAnswers } = await import('./answers');
    const row = (ts: number) => ({ ts, itemId: 'cafe.te', kind: 'type', verdict: 'correct' as const, mode: 'learn' as const, ms: 900 });
    await db.answers.clear();
    await db.answers.bulkAdd([row(T - 91 * DAY), row(T - 89 * DAY), row(T)]);
    await pruneAnswers(T);
    const left = await db.answers.orderBy('ts').toArray();
    expect(left.map((r) => r.ts)).toEqual([T - 89 * DAY, T]);
  });
});
