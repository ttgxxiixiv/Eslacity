import { type AnswerRecord, keepSince, LOG_MAX_ROWS } from '../domain/answerLog';
import { db } from './db';
import { persist } from './persist';

/** Записать ответ в журнал. Запись идёт после отрисовки и не задерживает интерфейс. */
export function logAnswer(r: Omit<AnswerRecord, 'id' | 'ts'>, now = Date.now()): void {
  persist(() => db.answers.add({ ...r, ts: now }));
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
