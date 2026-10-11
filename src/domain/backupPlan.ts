import type { Lang } from '../lang';

/**
 * Копия прогресса (задача 16.7). Прогресс живёт только на устройстве, поэтому раз в неделю игра просит сохранить
 * путь в файл (кнопка «Копия» на главной ведёт в раздел «Данные и копии»). В приложении для Android копия делается
 * сама при запуске, раз в неделю, в «Документы/Eslacity», и хранятся последние `AUTO_KEEP`.
 */

export const DAY_MS = 86_400_000;
/** Как часто просить копию и делать автокопию. */
export const BACKUP_EVERY_DAYS = 7;
/** Сколько автокопий языка хранить в приложении. */
export const AUTO_KEEP = 4;

export interface BackupRecord {
  /** С какого момента считать неделю, если копий ещё не было: первый запуск с этой записью. */
  since?: number;
  /** Последняя копия: своя или автокопия. */
  saved?: number;
  /** Последняя автокопия (только в приложении). */
  auto?: number;
  /** Игрок отложил напоминание. */
  snoozed?: number;
}

/** Запись при запуске: у новой отметка, с какого дня считать неделю. */
export const startBackup = (r: BackupRecord | undefined, now: number): BackupRecord => (r?.since !== undefined ? r : { ...r, since: now });

/** Дней с последней копии; копий не было — undefined. */
export const daysSinceBackup = (r: BackupRecord, now: number): number | undefined =>
  r.saved === undefined ? undefined : Math.floor((now - r.saved) / DAY_MS);

/**
 * Пора напомнить о копии: прогресс есть и неделя прошла с последней копии, с отложенного напоминания и с начала
 * отсчёта (новый игрок не видит напоминание в первый же день).
 */
export function backupDue(r: BackupRecord, hasProgress: boolean, now: number): boolean {
  if (!hasProgress) return false;
  const last = Math.max(r.saved ?? 0, r.snoozed ?? 0, r.since ?? now);
  return now - last >= BACKUP_EVERY_DAYS * DAY_MS;
}

/** Пора делать автокопию в приложении. */
export const autoBackupDue = (r: BackupRecord, hasProgress: boolean, now: number): boolean =>
  hasProgress && (r.auto === undefined || now - r.auto >= BACKUP_EVERY_DAYS * DAY_MS);

const ymd = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Имя файла копии: `eslacity-es-2026-10-11.json`, у автокопии — `eslacity-es-auto-2026-10-11.json`. */
export const backupFileName = (lang: Lang, now: number, auto = false): string => `eslacity-${lang}-${auto ? 'auto-' : ''}${ymd(now)}.json`;

/** Автокопии языка, которые пора удалить: все, кроме последних `keep` (по дате в имени). Чужие файлы не трогаются. */
export function staleAutoBackups(names: string[], lang: Lang, keep = AUTO_KEEP): string[] {
  const re = new RegExp(`^eslacity-${lang}-auto-\\d{4}-\\d{2}-\\d{2}\\.json$`);
  const own = names.filter((n) => re.test(n)).sort();
  return own.slice(0, Math.max(0, own.length - keep));
}
