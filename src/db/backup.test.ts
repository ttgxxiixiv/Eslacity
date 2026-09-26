import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';

describe('резервная копия', () => {
  it('экспорт → импорт восстанавливает данные', async () => {
    await db.cards.put({ wordId: 'cafe.te', ef: 2.5, interval: 1, stability: 1, difficulty: 5, state: 2, reps: 1, due: 5, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
    await db.meta.put({ key: 'coins', value: 42 });
    const b = parseBackup(JSON.stringify(await exportBackup()));
    await db.cards.clear();
    await db.meta.put({ key: 'coins', value: 0 });
    await importBackup(b);
    expect(await db.cards.get('cafe.te')).toMatchObject({ due: 5 });
    expect((await db.meta.get('coins'))?.value).toBe(42);
  });
  it('журнал ответов попадает в копию, а старая копия без него загружается', async () => {
    await db.answers.add({ ts: 5, itemId: 'cafe.te', kind: 'type', verdict: 'correct', mode: 'learn', ms: 800 });
    const b = await exportBackup();
    expect(b.data.answers).toHaveLength(1);

    const { answers: _drop, ...oldData } = b.data;
    const old = parseBackup(JSON.stringify({ ...b, data: oldData }));
    await importBackup(old);
    expect(await db.answers.count()).toBe(0);
    expect(await db.cards.get('cafe.te')).toBeDefined();
  });

  it('отклоняет чужой файл', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow(/не файл прогресса/);
  });
  it('старая копия с карточками SM-2 загружается и переводится в FSRS', async () => {
    const old = {
      app: 'eslacity', version: 1, exportedAt: 1,
      data: {
        cards: [{ wordId: 'cafe.leche', ef: 1.3, interval: 12, reps: 4, due: 77, lapses: 1, learnedAt: 1, lastReviewedAt: 2 }],
        buildings: [], grammar: [], days: [], meta: [],
      },
    };
    await importBackup(parseBackup(JSON.stringify(old)));
    expect(await db.cards.get('cafe.leche')).toMatchObject({ due: 77, interval: 12, stability: 12, difficulty: 9, state: 2 });
  });
});
