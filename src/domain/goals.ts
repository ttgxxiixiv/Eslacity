import type { DayRow } from '../db/db';
import { dayNumber } from './srs';

export type WeeklyMetric = 'newWords' | 'reviews' | 'grammarLessons' | 'goalDays';

export interface WeeklyChallenge {
  id: WeeklyMetric;
  text: string;
  target: number;
  reward: number;
}

export const WEEKLY_TEMPLATES: WeeklyChallenge[] = [
  { id: 'newWords', text: 'Выучить 40 новых слов', target: 40, reward: 200 },
  { id: 'reviews', text: 'Сделать 150 повторений', target: 150, reward: 200 },
  { id: 'grammarLessons', text: 'Пройти 5 уроков грамматики', target: 5, reward: 200 },
  { id: 'goalDays', text: 'Выполнить дневную цель 5 дней', target: 5, reward: 200 },
];

/** Номер дня понедельника текущей недели. dayNumber(0) = четверг 1 января 1970. */
export function weekStart(day: number): number {
  return day - ((day + 3) % 7);
}

export function weekKey(day: number): string {
  return `w${weekStart(day)}`;
}

export function challengeFor(day: number): WeeklyChallenge {
  const idx = Math.floor(weekStart(day) / 7);
  return WEEKLY_TEMPLATES[idx % WEEKLY_TEMPLATES.length];
}

function rowDay(r: DayRow): number {
  const [y, m, d] = r.date.split('-').map(Number);
  return dayNumber(new Date(y, m - 1, d, 12).getTime());
}

export function weekRows(rows: DayRow[], today: number): DayRow[] {
  const start = weekStart(today);
  return rows.filter((r) => {
    const d = rowDay(r);
    return d >= start && d < start + 7;
  });
}

export function weeklyProgress(c: WeeklyChallenge, rows: DayRow[], today: number): number {
  const week = weekRows(rows, today);
  const id = c.id;
  if (id === 'goalDays') return week.filter((r) => r.goalMet).length;
  return week.reduce((n, r) => n + (r[id] ?? 0), 0);
}
