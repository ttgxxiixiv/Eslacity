import { CURRENT } from '../lib/update';
import { formatReports, type ReportReason, type ReportRecord } from '../domain/report';
import { LANG } from '../lang';
import { db } from './db';

/** Сохранить отчёт об ошибке в задании (задача 11.1). */
export async function addReport(r: { itemId: string; context: string; reason: ReportReason; note: string }, now = Date.now()): Promise<void> {
  await db.reports.add({ ...r, ts: now, version: CURRENT.version });
}

export function reportsCount(): Promise<number> {
  return db.reports.count();
}

/** Все отчёты одним текстом: для «Скопировать отчёты». */
export async function reportsText(): Promise<string> {
  return formatReports(await db.reports.toArray(), LANG, CURRENT.version);
}

export function clearReports(): Promise<void> {
  return db.reports.clear();
}

export type { ReportRecord };
