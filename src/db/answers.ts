import { playSfx } from '../audio/sfx';
import { type AnswerRecord, keepSince, LOG_MAX_ROWS } from '../domain/answerLog';
import { db } from './db';
import { persist } from './persist';

/** Записать ответ в журнал. Запись идёт после отрисовки и не задерживает интерфейс. */
export function logAnswer(r: Omit<AnswerRecord, 'id' | 'ts'>, now = Date.now()): void {
  persist(() => db.answers.add({ ...r, ts: now }));
  // Каждый ответ игрока проходит здесь: звук вердикта (задача 13.3) звучит в уроках, миссиях, блице и испытаниях.
  playSfx(r.verdict);
}

/** Убрать записи старше 90 дней и самые старые сверх 20 000. Вызывается при запуске. */
export async function pruneAnswers(now = Date.now()): Promise<void> {
  await db.answers.where('ts').below(keepSince(now)).delete();
  const extra = (await db.answers.count()) - LOG_MAX_ROWS;
  if (extra > 0) {
    const keys = await db.answers.orderBy('ts').limit(extra).primaryKeys();
    await db.answers.bulkDelete(keys);
  }
}

/** Ответы журнала начиная с момента `since`: для работы над ошибками (задача 12.2). */
export function answersSince(since: number): Promise<AnswerRecord[]> {
  return db.answers.where('ts').aboveOrEqual(since).toArray();
}
