import { describe, expect, it } from 'vitest';
import type { Phrase, Word } from '../content/schema';
import { seeded } from './generators';
import {
  buildTrial, finishTrial, isTrialDone, TRIAL_ECHO, TRIAL_EXPRESSIONS, isTrialPassed, isTypedItem, parseTrialId, TRIAL_COOLDOWN_MS, TRIAL_SIZE, trialId, trialsPassed,
  trialStatus, waitLabel,
} from './trial';

const word = (i: number): Word => ({
  id: `cafe.w${i}`, es: `palabra${i}`, ru: `слово ${i}`, pos: 'noun', level: 1, cefr: 'A1', example: { es: `Una palabra${i} aquí.`, ru: `Слово ${i} здесь.` },
});
const phrase = (i: number): Phrase => ({ id: `ph:cafe.p${i}`, es: `Un café número ${i}, por favor.`, ru: `Кофе номер ${i}, пожалуйста.`, level: 1 });
const words = Array.from({ length: 24 }, (_, i) => word(i));
const phrases = Array.from({ length: 8 }, (_, i) => phrase(i));

describe('задания испытания', () => {
  it('глава V: пять выражений, два из них — в другом регистре, как в «Эхе»', () => {
    // Шесть выражений парами «официально — по-свойски» и обычные слова.
    const expr = (i: number): Word => ({
      ...word(100 + i), id: `cafe.e${i}`, es: `una expresión número ${i}`, level: 7, cefr: 'C1', pos: 'phrase',
      kind: 'formula', register: i % 2 ? 'informal' : 'formal', pair: `cafe.e${i % 2 ? i - 1 : i + 1}`,
    });
    const exprs = Array.from({ length: 6 }, (_, i) => expr(i));
    const pool = [...words, ...exprs];
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildTrial(pool, phrases, pool, phrases, seeded(seed), { expressions: true });
      expect(items).toHaveLength(TRIAL_SIZE);
      const echo = items.filter((i) => i.kind === 'grammar');
      expect(echo).toHaveLength(TRIAL_ECHO);
      expect(echo.every((i) => i.kind === 'grammar' && i.item.ex.kind === 'register' && i.cardId?.startsWith('cafe.e'))).toBe(true);
      const exprWords = items.filter((i) => i.kind === 'word' && (i.step as { wordId: string }).wordId.startsWith('cafe.e'));
      expect(exprWords.length + echo.length).toBe(TRIAL_EXPRESSIONS);
      // «Эхо» идёт вместо выбора, а не вместо ввода: доля ввода та же.
      expect(items.filter(isTypedItem)).toHaveLength(9);
    }
    // Выражений без пары много, с парой — одна пара: «Эхо» всё равно достаётся обеим.
    const lone = Array.from({ length: 12 }, (_, i): Word => ({ ...expr(10 + i), id: `cafe.x${i}`, es: `otra expresión ${i}`, pair: undefined }));
    const mixed = [...words, ...exprs.slice(0, 2), ...lone];
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildTrial(mixed, phrases, mixed, phrases, seeded(seed), { expressions: true });
      expect(items.filter((i) => i.kind === 'grammar')).toHaveLength(TRIAL_ECHO);
    }
    // Без флага выражения берутся как обычные слова.
    expect(buildTrial(pool, phrases, pool, phrases, seeded(1)).some((i) => i.kind === 'grammar')).toBe(false);
  });
  it('15 заданий: пять фраз и десять слов, каждое по разу, ввода 60%', () => {
    const items = buildTrial(words, phrases, words, phrases, seeded(1));
    expect(items).toHaveLength(TRIAL_SIZE);
    expect(items.filter((i) => i.kind === 'phrase')).toHaveLength(5);
    const ids = items.map((i) => (i.kind === 'word' ? (i.step as { wordId: string }).wordId : i.kind === 'phrase' ? i.step.id : i.item.ex.id));
    expect(new Set(ids).size).toBe(TRIAL_SIZE);
    expect(items.filter(isTypedItem)).toHaveLength(9);
    // Ни знакомства, ни «пар»: только задания с ответом.
    expect(items.some((i) => i.kind === 'word' && (i.step.kind === 'intro' || i.step.kind === 'match'))).toBe(false);
  });
  it('без выученных фраз — одни слова, без слуха — без заданий на слух', () => {
    const items = buildTrial(words, [], words, phrases, seeded(2), { listening: false });
    expect(items).toHaveLength(TRIAL_SIZE);
    expect(items.every((i) => i.kind === 'word')).toBe(true);
    expect(items.some((i) => i.kind === 'word' && i.step.kind.startsWith('listen'))).toBe(false);
    expect(items.filter(isTypedItem)).toHaveLength(9);
  });
  it('со слухом — один диктант среди вводов', () => {
    const items = buildTrial(words, phrases, words, phrases, seeded(3), { listening: true });
    expect(items.filter((i) => i.kind === 'word' && i.step.kind === 'listen-type')).toHaveLength(1);
  });
  it('мало материала — заданий меньше, доля ввода та же', () => {
    const items = buildTrial(words.slice(0, 8), phrases.slice(0, 2), words, phrases, seeded(4));
    expect(items).toHaveLength(10);
    expect(items.filter(isTypedItem)).toHaveLength(6);
  });
});

describe('результат и попытки', () => {
  it('порог 80%, «почти» засчитывается', () => {
    expect(isTrialPassed(12, 0, 15)).toBe(true);
    expect(isTrialPassed(10, 2, 15)).toBe(true);
    expect(isTrialPassed(11, 0, 15)).toBe(false);
    expect(isTrialPassed(0, 0, 0)).toBe(false);
  });
  it('статус: слова не выучены, можно, ждать сутки после неудачи, пройдено', () => {
    expect(trialStatus(undefined, 3, 0)).toEqual({ kind: 'locked', wordsLeft: 3 });
    expect(trialStatus(undefined, 0, 0)).toEqual({ kind: 'open' });
    const failed = finishTrial(undefined, 0.6, false, 1000);
    expect(failed).toEqual({ rec: { attempts: 1, best: 0.6, failedAt: 1000 }, first: false });
    expect(trialStatus(failed.rec, 0, 1000 + TRIAL_COOLDOWN_MS - 1)).toEqual({ kind: 'wait', until: 1000 + TRIAL_COOLDOWN_MS });
    expect(trialStatus(failed.rec, 0, 1000 + TRIAL_COOLDOWN_MS)).toEqual({ kind: 'open' });
    const passed = finishTrial(failed.rec, 0.9, true, 5000);
    expect(passed).toEqual({ rec: { attempts: 2, best: 0.9, done: 5000 }, first: true });
    expect(trialStatus(passed.rec, 0, 5000)).toEqual({ kind: 'done' });
    // Пройденное не теряется и награда второй раз не выдаётся.
    expect(finishTrial(passed.rec, 0.5, false, 9000)).toEqual({ rec: { attempts: 3, best: 0.9, done: 5000 }, first: false });
  });
  it('id, пройденные и счётчик «Испытателя»', () => {
    expect(trialId('cafe', 2)).toBe('tr:cafe.2');
    expect(parseTrialId('tr:cafe.2')).toEqual({ place: 'cafe', chapter: 2 });
    expect(parseTrialId('ms:cafe.2')).toBeNull();
    const records = { 'tr:cafe.1': { attempts: 1, best: 1, done: 5 }, 'tr:park.1': { attempts: 1, best: 0.5, failedAt: 5 } };
    expect(isTrialDone(records, 'cafe', 1)).toBe(true);
    expect(isTrialDone(records, 'park', 1)).toBe(false);
    expect(trialsPassed(records)).toBe(1);
  });
  it('подпись ожидания', () => {
    expect(waitLabel(5 * 3600_000, 0)).toBe('через 5 ч');
    expect(waitLabel(40 * 60_000, 0)).toBe('через 40 мин');
  });
});
