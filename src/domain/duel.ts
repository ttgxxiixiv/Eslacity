import type { Verdict } from './answer';

/**
 * Схватка со стражем (задача 13.5) поверх испытания: у стража полоска силы, у героя щиты. Верный ответ («почти»
 * тоже) — удар, ошибка — страж отражает и разбивает щит. Три верных подряд — приём: удар вдвое сильнее. Исход тот же,
 * что у испытания: победа при доле верных не ниже порога. Поэтому полоска не опускается до нуля, пока верных меньше
 * порога (приёмы только быстрее сносят силу), а щитов ровно столько, сколько ошибок порог прощает.
 */

/** Сколько верных подряд складываются в приём. */
export const COMBO_STREAK = 3;
/** Урон приёма в обычных ударах. */
export const COMBO_DAMAGE = 2;
/** Последний клочок силы стража, пока порог не взят: полоска не обманывает игрока досрочной победой. */
export const LAST_STAND = 0.06;

export type DuelEvent = 'strike' | 'combo' | 'parry';

export interface DuelState {
  /** Сила стража от 1 до 0. */
  strength: number;
  /** Щитов у героя осталось и было. */
  shields: number;
  maxShields: number;
  /** Верных подряд. */
  streak: number;
  /** Что случилось на последнем ответе. */
  last: DuelEvent | null;
  /** Порог взят: страж повержен, сколько бы заданий ни осталось. */
  won: boolean;
  /** Щиты разбиты и ещё одна ошибка: порог уже не взять. */
  lost: boolean;
}

/** Сколько верных нужно для победы и сколько ошибок прощается. */
export function duelShape(total: number, pass: number): { need: number; shields: number } {
  const need = Math.ceil(total * pass - 1e-9);
  return { need, shields: total - need };
}

/** Состояние схватки по ответам. */
export function duelState(verdicts: Verdict[], total: number, pass: number): DuelState {
  const { need, shields } = duelShape(total, pass);
  let hits = 0;
  let damage = 0;
  let misses = 0;
  let streak = 0;
  let last: DuelEvent | null = null;
  for (const v of verdicts) {
    if (v === 'wrong') {
      misses++;
      streak = 0;
      last = 'parry';
      continue;
    }
    hits++;
    streak++;
    const combo = streak % COMBO_STREAK === 0;
    damage += combo ? COMBO_DAMAGE : 1;
    last = combo ? 'combo' : 'strike';
  }
  const won = hits >= need;
  const strength = won ? 0 : Math.max(LAST_STAND, 1 - damage / need);
  return { strength, shields: Math.max(0, shields - misses), maxShields: shields, streak, last, won, lost: misses > shields };
}

/** После какого ответа страж говорит реплику середины схватки. */
export const midAnswer = (total: number) => Math.floor(total / 2);
