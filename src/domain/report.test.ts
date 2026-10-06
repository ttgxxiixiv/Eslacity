import { describe, expect, it } from 'vitest';
import { formatReports, type ReportRecord } from './report';

const r = (ts: number, extra: Partial<ReportRecord> = {}): ReportRecord => ({ ts, itemId: 'cafe.te', context: 'el té — чай', reason: 'translation', note: '', version: '2.120.0', ...extra });

describe('отчёты об ошибках', () => {
  it('шапка, строка на отчёт, старые сверху, версия — если другая', () => {
    const t = formatReports([r(new Date(2026, 9, 6, 15, 5).getTime(), { note: '  лучше\n«чай»  ', reason: 'typo' }), r(new Date(2026, 9, 6, 9, 0).getTime(), { version: '2.119.0' })], 'es', '2.120.0');
    expect(t.split('\n')).toEqual([
      'Eslacity 2.120.0 · es · отчётов: 2',
      '2026-10-06 09:00 · cafe.te · «el té — чай» · Неверный перевод (версия 2.119.0)',
      '2026-10-06 15:05 · cafe.te · «el té — чай» · Опечатка: лучше «чай»',
    ]);
  });
  it('без отчётов — только шапка', () => {
    expect(formatReports([], 'it', '2.120.0')).toBe('Eslacity 2.120.0 · it · отчётов: 0');
  });
});
