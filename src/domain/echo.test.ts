import { describe, expect, it } from 'vitest';
import type { Word } from '../content/schema';
import { echoExercise, echoExercises, ECHO_BUILD_INTERVAL } from './echo';
import { seeded } from './generators';
import { checkGrammar, toItem } from './grammar';
import { phraseTokens } from './phraseSteps';
import type { SrsCard } from './srs';

const w = (id: string, es: string, register: Word['register'], pair?: string): Word => ({
  id, es, ru: es, pos: 'phrase', level: 7, cefr: 'C1', kind: 'collocation', register, pair, example: { es, ru: es },
});
const words = [
  w('bank.a', 'proceder al pago', 'formal', 'bank.b'),
  w('bank.b', 'soltar la pasta', 'informal', 'bank.a'),
  w('bank.c', 'carecer de fondos', 'formal', 'bank.d'),
  w('bank.d', 'estar sin blanca', 'informal', 'bank.c'),
  w('bank.e', 'cuenta de ahorro', 'neutral'),
];
const byId = Object.fromEntries(words.map((x) => [x.id, x]));
const card = (interval: number) => ({ wordId: 'bank.b', interval } as SrsCard);

describe('задание «Эха»', () => {
  it('свежее выражение — выбор из трёх, исходная фраза — пара, регистр — у ответа', () => {
    const ex = echoExercise(byId['bank.b'], byId['bank.a'], words, card(1), seeded(1));
    expect(ex.kind).toBe('register');
    if (ex.kind !== 'register' || !('options' in ex)) throw new Error('ожидался выбор');
    expect(ex.source).toBe('proceder al pago');
    expect(ex.to).toBe('informal');
    expect(ex.options[ex.answer]).toBe('soltar la pasta');
    expect(new Set(ex.options).size).toBe(3);
    expect(ex.options).not.toContain('proceder al pago');
    // Первый неверный вариант — того же регистра.
    expect(ex.options).toContain('estar sin blanca');
  });

  it('закрепилось — сборка из плиток, лишние плитки не из ответа, ответ засчитывается', () => {
    const ex = echoExercise(byId['bank.b'], byId['bank.a'], words, card(ECHO_BUILD_INTERVAL), seeded(2));
    if (ex.kind !== 'register' || 'options' in ex) throw new Error('ожидалась сборка');
    expect(ex.extra).toHaveLength(2);
    for (const t of ex.extra) expect(phraseTokens('soltar la pasta')).not.toContain(t);
    const item = toItem(ex, seeded(3));
    expect(checkGrammar(item, { tiles: phraseTokens('soltar la pasta') }).verdict).toBe('correct');
    expect(checkGrammar(item, { tiles: [ex.extra[0], ...phraseTokens('soltar la pasta').slice(1)] }).verdict).toBe('wrong');
  });

  it('выражение без пары среди загруженных в поручение не попадает', () => {
    const list = echoExercises(['bank.a', 'bank.b', 'bank.e', 'bank.zz'], byId, words, {}, seeded(4));
    expect(list.map((x) => x.cardId)).toEqual(['bank.a', 'bank.b']);
  });
});
