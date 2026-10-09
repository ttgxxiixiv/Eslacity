import { describe, expect, it } from 'vitest';
import type { Verdict } from './answer';
import { duelShape, duelState, LAST_STAND, midAnswer } from './duel';
import { GUARDIAN_PASS, GUARDIAN_SIZE, isGuardianPassed } from './guardian';

const ok = (n: number): Verdict[] => Array(n).fill('correct');
const bad = (n: number): Verdict[] => Array(n).fill('wrong');

describe('схватка со стражем', () => {
  it('20 заданий и 75%: нужно 15 верных, щитов пять', () => {
    expect(duelShape(GUARDIAN_SIZE, GUARDIAN_PASS)).toEqual({ need: 15, shields: 5 });
  });
  it('удар, приём каждые три верных подряд, страж отражает ошибку', () => {
    expect(duelState(ok(1), 20, 0.75)).toMatchObject({ last: 'strike', streak: 1 });
    expect(duelState(ok(3), 20, 0.75)).toMatchObject({ last: 'combo', streak: 3 });
    const s = duelState([...ok(2), 'wrong'], 20, 0.75);
    expect(s).toMatchObject({ last: 'parry', streak: 0, shields: 4 });
    // Приём снимает вдвое больше: три верных подряд — 4 удара из 15, три вразбивку — 3.
    expect(duelState(ok(3), 20, 0.75).strength).toBeCloseTo(1 - 4 / 15);
    expect(duelState(['correct', 'wrong', 'correct', 'wrong', 'correct'], 20, 0.75).strength).toBeCloseTo(1 - 3 / 15);
  });
  it('полоска не обнуляется раньше порога, хоть приёмы и сносят силу быстрее', () => {
    const s = duelState(ok(14), 20, 0.75);
    expect(s.won).toBe(false);
    expect(s.strength).toBe(LAST_STAND);
    expect(duelState(ok(15), 20, 0.75)).toMatchObject({ won: true, strength: 0 });
    // «Почти» засчитывается как удар, как и в испытании.
    expect(duelState([...ok(14), 'almost'], 20, 0.75).won).toBe(true);
  });
  it('исход схватки совпадает с порогом испытания', () => {
    for (let wrong = 0; wrong <= 20; wrong++) {
      const v: Verdict[] = [...ok(20 - wrong), ...bad(wrong)];
      const s = duelState(v, 20, GUARDIAN_PASS);
      expect(s.won).toBe(isGuardianPassed(20 - wrong, 0, 20));
      expect(s.lost).toBe(!isGuardianPassed(20 - wrong, 0, 20));
    }
  });
  it('реплика середины — после десятого ответа', () => expect(midAnswer(20)).toBe(10));
});
