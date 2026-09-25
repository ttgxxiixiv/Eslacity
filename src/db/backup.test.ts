import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { exportBackup, importBackup, parseBackup } from './backup';

describe('резервная копия', () => {
  it('экспорт → импорт восстанавливает данные', async () => {
    await db.cards.put({ wordId: 'cafe.te', ef: 2.5, interval: 1, reps: 1, due: 5, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
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
});
