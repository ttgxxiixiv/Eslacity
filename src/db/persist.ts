import { afterPaint } from '../lib/afterPaint';

/** Запись в IndexedDB после отрисовки. Ошибки логируем, интерфейс не ломаем. */
export function persist(task: () => Promise<unknown>): void {
  afterPaint(() => {
    task().catch((e) => console.error('IndexedDB write failed', e));
  });
}
