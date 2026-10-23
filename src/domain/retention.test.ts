import { describe, expect, it } from 'vitest';
import { addSamples, CALIBRATION_KEEP, calibration, RETENTION, retentionHint, type CalSample } from './retention';
import { dayNumber, newCard, rescheduled, review } from './srs';

const T0 = new Date(2026, 0, 10, 15, 0).getTime();
const DAY = 86_400_000;

/** Карточка после трёх верных повторов по расписанию «Обычно». */
function learned() {
  let c = review(newCard('cafe.te', T0), 4, T0);
  let t = T0;
  for (let i = 0; i < 3; i++) {
    t = (c.due - dayNumber(T0)) * DAY + T0;
    c = review(c, 4, t);
  }
  return { c, t };
}

describe('запоминаемость (задача 21.2)', () => {
  it('реже — интервал длиннее, надёжнее — короче', () => {
    const { c, t } = learned();
    const next = (r: number) => review(c, 4, t + c.interval * DAY, r).interval;
    expect(next(RETENTION.light)).toBeGreaterThan(next(RETENTION.normal));
    expect(next(RETENTION.normal)).toBeGreaterThan(next(RETENTION.firm));
  });

  it('пересчёт сроков: от последнего повтора по стабильности, новая карточка не меняется', () => {
    const { c } = learned();
    const same = rescheduled(c, RETENTION.normal);
    expect(same.due).toBe(c.due);
    const light = rescheduled(c, RETENTION.light);
    const firm = rescheduled(c, RETENTION.firm);
    expect(light.due).toBeGreaterThan(c.due);
    expect(firm.due).toBeLessThan(c.due);
    expect(firm.due).toBe(dayNumber(c.lastReviewedAt) + firm.interval);
    const fresh = newCard('cafe.cafe', T0);
    expect(rescheduled(fresh, RETENTION.firm)).toEqual(fresh);
  });

  it('сверка с прогнозом: подсказка только после сотни повторов и при заметной разнице', () => {
    const batch = (n: number, pred: number, okShare: number): CalSample[] =>
      Array.from({ length: n }, (_, i): CalSample => [pred, i < n * okShare ? 1 : 0]);
    expect(retentionHint(batch(80, 900, 1), 'normal')).toBeNull();
    expect(retentionHint(batch(200, 900, 0.92), 'normal')).toBeNull();
    const better = retentionHint(batch(200, 900, 0.98), 'normal')!;
    expect(better).toMatchObject({ kind: 'better', suggest: 'light' });
    expect(better.cal.actual).toBeCloseTo(0.98);
    expect(better.cal.predicted).toBeCloseTo(0.9);
    expect(retentionHint(batch(200, 900, 0.8), 'normal')).toMatchObject({ kind: 'worse', suggest: 'firm' });
    expect(retentionHint(batch(200, 900, 0.8), 'firm')).toMatchObject({ kind: 'worse', suggest: null });
    expect(calibration([])).toBeNull();
  });

  it('хранится только последние повторы', () => {
    const many = addSamples([], Array.from({ length: CALIBRATION_KEEP + 50 }, (_, i): CalSample => [i, 1]));
    expect(many).toHaveLength(CALIBRATION_KEEP);
    expect(many[0][0]).toBe(50);
  });
});
