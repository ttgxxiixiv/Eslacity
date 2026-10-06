import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

describe('отчёты об ошибках в базе', () => {
  it('база версии 3 открывается без потерь, появляется пустая таблица отчётов; отчёт попадает в копию', async () => {
    // База в том виде, в каком она была до отчётов: карточки FSRS, журнал ответов.
    const old = new Dexie('eslacity');
    old.version(3).stores({ cards: 'wordId, due', buildings: 'locationId', grammar: 'lessonId', days: 'date', meta: 'key', answers: '++id, ts, itemId, mode' });
    await old.table('cards').put({ wordId: 'cafe.te', stability: 6, difficulty: 5, state: 2, due: 100, lapses: 0, reps: 2, learnedAt: 1, lastReviewedAt: 1 });
    await old.table('meta').put({ key: 'coins', value: 77 });
    await old.table('answers').add({ ts: 5, itemId: 'cafe.te', kind: 'type', verdict: 'correct', mode: 'learn', ms: 800 });
    old.close();

    const { db } = await import('./db');
    expect(await db.cards.get('cafe.te')).toMatchObject({ stability: 6, due: 100 });
    expect((await db.meta.get('coins'))?.value).toBe(77);
    expect(await db.answers.count()).toBe(1);
    expect(await db.reports.count()).toBe(0);
    expect(db.verno).toBe(4);

    const { addReport, reportsText, clearReports } = await import('./reports');
    await addReport({ itemId: 'cafe.te', context: 'el té — чай', reason: 'translation', note: 'не тот' }, new Date(2026, 9, 6, 12).getTime());
    expect(await reportsText()).toMatch(/cafe\.te · «el té — чай» · Неверный перевод: не тот$/);

    // Отчёты едут в резервной копии, старая копия без них загружается и отчёты очищает.
    const { exportBackup, importBackup, parseBackup } = await import('./backup');
    const b = await exportBackup();
    expect(b.data.reports).toHaveLength(1);
    await clearReports();
    await importBackup(parseBackup(JSON.stringify(b)));
    expect(await db.reports.count()).toBe(1);
    const { reports: _drop, ...oldData } = b.data;
    await importBackup(parseBackup(JSON.stringify({ ...b, data: oldData })));
    expect(await db.reports.count()).toBe(0);
    expect(await db.cards.get('cafe.te')).toBeDefined();
  });
});
