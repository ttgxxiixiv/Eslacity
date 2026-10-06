import { describe, expect, it } from 'vitest';
import type { AnswerRecord } from './answerLog';
import { MISTAKES_DAYS, mistakesPlan, skillOf, skillStats, weakItems, whyCounts } from './mistakes';

const DAY = 86_400_000;
const NOW = 100 * DAY;
let t = NOW - 10 * DAY;
const row = (itemId: string, verdict: AnswerRecord['verdict'], kind = 'type', ms = 3000, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({
  itemId, verdict, kind, ms, mode: 'review', ts: (t += 1000), ...extra,
});

describe('слабые места по журналу (задача 12.2)', () => {
  it('ошибки весят больше «почти», исправленное и старое не берётся', () => {
    const rows = [
      row('cafe.te', 'wrong'), row('cafe.te', 'wrong'),
      row('cafe.cafe', 'almost'),
      // Исправлено: два последних ответа верны.
      row('cafe.leche', 'wrong'), row('cafe.leche', 'correct'), row('cafe.leche', 'correct'),
      // Старше 30 дней.
      row('cafe.agua', 'wrong', 'type', 3000, { ts: NOW - (MISTAKES_DAYS + 1) * DAY }),
    ];
    expect(weakItems(rows, NOW).map((w) => [w.itemId, w.score])).toEqual([['cafe.te', 4], ['cafe.cafe', 1]]);
  });
  it('медленный верный ответ — тоже слабое место; формы кузницы и удалённые карточки не берутся', () => {
    const rows = [
      ...['a', 'b', 'c'].map((x) => row(`cafe.${x}`, 'correct', 'type', 3000)),
      row('cafe.slow', 'correct', 'type', 20_000),
      row('v:hablar.presente.1', 'wrong'),
      row('cafe.gone', 'wrong'),
    ];
    const weak = weakItems(rows, NOW, (id) => id !== 'cafe.gone');
    expect(weak.map((w) => [w.itemId, w.slow])).toEqual([['cafe.slow', 1]]);
  });
  it('вид задания — тот, где ошибались чаще', () => {
    const rows = [row('cafe.te', 'wrong', 'listen-type'), row('cafe.te', 'wrong', 'listen-type'), row('cafe.te', 'wrong', 'choice-es-ru')];
    expect(weakItems(rows, NOW)[0].kind).toBe('listen-type');
  });
  it('причины ошибок и навыки', () => {
    const rows = [
      row('cafe.te', 'wrong', 'type', 3000, { why: 'article' }),
      row('cafe.te', 'almost', 'type', 3000, { why: 'accent' }),
      row('cafe.cafe', 'wrong', 'type', 3000, { why: 'article' }),
      row('cafe.leche', 'correct', 'listen-choice'),
      row('g:a1.02-ser.3', 'wrong', 'grammar-gap'),
    ];
    expect(whyCounts(rows)).toEqual({ article: 2, accent: 1 });
    expect(skillOf('listen-type')).toBe('listen');
    expect(skillOf('grammar-type')).toBe('type');
    expect(skillOf('phrase-type')).toBe('type');
    expect(skillOf('forge-presente')).toBe('type');
    expect(skillOf('grammar-gap')).toBe('choice');
    const s = skillStats(rows);
    expect([s.listen.total, s.type.total, s.choice.total]).toEqual([1, 3, 1]);
  });
  it('разбор: до десяти мест, не меньше четырёх, вид для слов', () => {
    const mk = (id: string, kind: string) => ({ itemId: id, wrong: 1, almost: 0, slow: 0, kind, score: 2, last: 0 });
    expect(mistakesPlan([mk('cafe.te', 'type'), mk('cafe.cafe', 'match'), mk('g:a1.02-ser.3', 'grammar-gap')])).toBeNull();
    const plan = mistakesPlan([
      mk('cafe.te', 'listen-type'), mk('cafe.cafe', 'match'), mk('g:a1.02-ser.3', 'grammar-gap'), mk('ph:cafe.un-cafe', 'phrase-type'),
      ...Array.from({ length: 10 }, (_, i) => mk(`home.w${i}`, 'type')),
    ])!;
    expect(plan.words.length + plan.rules.length + plan.phrases.length).toBe(10);
    expect(plan.kinds).toMatchObject({ 'cafe.te': 'listen-type', 'cafe.cafe': 'choice-es-ru' });
    expect(plan.rules).toEqual(['g:a1.02-ser.3']);
    expect(plan.phrases).toEqual(['ph:cafe.un-cafe']);
  });
});
