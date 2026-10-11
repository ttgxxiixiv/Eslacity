import { describe, expect, it } from 'vitest';
import { autoBackupDue, backupDue, backupFileName, DAY_MS, daysSinceBackup, staleAutoBackups, startBackup } from './backupPlan';

const T = new Date(2026, 9, 11, 12).getTime();

describe('копия прогресса (задача 16.7)', () => {
  it('отсчёт недели начинается с первого запуска с записью', () => {
    expect(startBackup(undefined, T)).toEqual({ since: T });
    expect(startBackup({ since: 5, saved: 7 }, T)).toEqual({ since: 5, saved: 7 });
  });

  it('напоминание через неделю после начала, копии или «позже», и только с прогрессом', () => {
    const r = { since: T };
    expect(backupDue(r, true, T + 6 * DAY_MS)).toBe(false);
    expect(backupDue(r, true, T + 7 * DAY_MS)).toBe(true);
    expect(backupDue(r, false, T + 30 * DAY_MS)).toBe(false);
    expect(backupDue({ ...r, saved: T + 7 * DAY_MS }, true, T + 10 * DAY_MS)).toBe(false);
    expect(backupDue({ ...r, snoozed: T + 7 * DAY_MS }, true, T + 13 * DAY_MS)).toBe(false);
    expect(backupDue({ ...r, snoozed: T + 7 * DAY_MS }, true, T + 14 * DAY_MS)).toBe(true);
  });

  it('автокопия: сразу, если её не было, потом раз в неделю', () => {
    expect(autoBackupDue({}, true, T)).toBe(true);
    expect(autoBackupDue({}, false, T)).toBe(false);
    expect(autoBackupDue({ auto: T }, true, T + 6 * DAY_MS)).toBe(false);
    expect(autoBackupDue({ auto: T }, true, T + 7 * DAY_MS)).toBe(true);
  });

  it('дни с последней копии', () => {
    expect(daysSinceBackup({}, T)).toBeUndefined();
    expect(daysSinceBackup({ saved: T - 3 * DAY_MS - 5 }, T)).toBe(3);
  });

  it('имена файлов и старые автокопии своего языка', () => {
    expect(backupFileName('es', T)).toBe('eslacity-es-2026-10-11.json');
    expect(backupFileName('it', T, true)).toBe('eslacity-it-auto-2026-10-11.json');
    const names = [
      'eslacity-es-auto-2026-09-06.json',
      'eslacity-es-auto-2026-10-04.json',
      'eslacity-es-auto-2026-09-13.json',
      'eslacity-es-auto-2026-09-20.json',
      'eslacity-es-auto-2026-09-27.json',
      'eslacity-it-auto-2026-08-01.json',
      'eslacity-es-2026-01-01.json',
      'notes.txt',
    ];
    expect(staleAutoBackups(names, 'es')).toEqual(['eslacity-es-auto-2026-09-06.json']);
    expect(staleAutoBackups(names, 'it')).toEqual([]);
    expect(staleAutoBackups(names, 'es', 2)).toEqual(['eslacity-es-auto-2026-09-06.json', 'eslacity-es-auto-2026-09-13.json', 'eslacity-es-auto-2026-09-20.json']);
  });
});
