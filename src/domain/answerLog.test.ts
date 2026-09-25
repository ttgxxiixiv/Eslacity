import { describe, expect, it } from 'vitest';
import { type AnswerRecord, answerMs, byKind, grammarItemId, isListening, keepSince, summarize } from './answerLog';

const T = 1_700_000_000_000;
const rec = (verdict: AnswerRecord['verdict'], kind = 'type', ts = T): AnswerRecord => ({
  ts, itemId: 'cafe.te', kind, verdict, mode: 'learn', ms: 1000,
});

describe('журнал ответов', () => {
  it('считает точность, «почти» — половина верного', () => {
    const s = summarize([rec('correct'), rec('correct'), rec('almost'), rec('wrong')]);
    expect(s).toEqual({ total: 4, correct: 2, almost: 1, wrong: 1, accuracy: 2.5 / 4 });
  });

  it('без ответов точность неизвестна', () => {
    expect(summarize([]).accuracy).toBeNull();
  });

  it('учитывает только ответы после заданного момента', () => {
    const s = summarize([rec('wrong', 'type', T - 10), rec('correct', 'type', T)], T);
    expect(s.total).toBe(1);
    expect(s.accuracy).toBe(1);
  });

  it('группирует по виду задания и узнаёт задания на слух', () => {
    const g = byKind([rec('correct', 'listen-type'), rec('wrong', 'listen-type'), rec('correct', 'type')]);
    expect(g['listen-type'].accuracy).toBe(0.5);
    expect(g.type.total).toBe(1);
    expect(isListening('listen-choice')).toBe(true);
    expect(isListening('blitz-es-ru')).toBe(false);
  });

  it('время ответа не бывает отрицательным и обрезается сверху', () => {
    expect(answerMs(T, T - 5)).toBe(0);
    expect(answerMs(T, T + 1234.4)).toBe(1234);
    expect(answerMs(T, T + 3_600_000)).toBe(600_000);
  });

  it('id упражнения грамматики нумеруется с единицы', () => {
    expect(grammarItemId('a1.02-ser', 0)).toBe('g:a1.02-ser.1');
  });

  it('хранит 90 дней', () => {
    expect(keepSince(T)).toBe(T - 90 * 86_400_000);
  });
});
