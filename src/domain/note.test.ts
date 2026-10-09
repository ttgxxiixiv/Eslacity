import { describe, expect, it } from 'vitest';
import type { NoteMust } from '../content/schema';
import type { LetterEntry } from './letter';
import { canSendNote, checkNote, hasVariant, NOTE_XP, noteXp } from './note';

const must: NoteMust[] = [
  { label: 'Когда', any: ['mañana'], hint: 'mañana' },
  { label: 'Планы', any: ['voy a', 'vamos a'], hint: 'voy a' },
  { label: 'Будущее', any: ['*ré', '*rá'], hint: 'iré' },
];

describe('hasVariant: слово, сочетание или окончание', () => {
  it('слово и сочетание — целиком, без регистра, ударений и знаков', () => {
    expect(hasVariant('¡Hasta MAÑANA!', 'mañana')).toBe(true);
    expect(hasVariant('Hasta manana', 'mañana')).toBe(true);
    expect(hasVariant('Mañanas frías', 'mañana')).toBe(false);
    expect(hasVariant('Voy, a ver', 'voy a')).toBe(true);
    expect(hasVariant('Voyager', 'voy a')).toBe(false);
  });
  it('окончание — с ударением и не всё слово', () => {
    expect(hasVariant('Llegaré tarde.', '*ré')).toBe(true);
    expect(hasVariant('Llegare tarde.', '*ré')).toBe(false);
    expect(hasVariant('madre', '*ré')).toBe(false);
    expect(hasVariant('ré', '*ré')).toBe(false);
    expect(hasVariant('Arriverò presto', '*rò')).toBe(true);
    expect(hasVariant("Se l'avessi saputo", 'avessi')).toBe(true);
  });
});

describe('checkNote', () => {
  it('находит пункты и называет пропущенные', () => {
    expect(checkNote('Mañana voy a ir a tu fiesta. Llevaré una tarta.', must)).toEqual({ found: [0, 1, 2], missing: [] });
    expect(checkNote('Hoy voy a ir a tu fiesta.', must)).toEqual({ found: [1], missing: [0, 2] });
  });
  it('записку можно проверить от десяти слов', () => {
    expect(canSendNote('Hola, mañana voy a tu fiesta.')).toBe(false);
    expect(canSendNote('Hola, Lola, mañana voy a ir a tu fiesta a las ocho.')).toBe(true);
  });
});

describe('noteXp', () => {
  const entry = (checks: number[]): LetterEntry => ({ letterId: 'nt:cafe', text: '…', checks, at: 0 });
  const full = { found: [0, 1, 2], missing: [] };
  it('опыт — за первую полную записку', () => {
    expect(noteXp([], 'nt:cafe', 3, full)).toBe(NOTE_XP);
    expect(noteXp([], 'nt:cafe', 3, { found: [0], missing: [1, 2] })).toBe(0);
    expect(noteXp([entry([0])], 'nt:cafe', 3, full)).toBe(NOTE_XP);
    expect(noteXp([entry([0, 1, 2])], 'nt:cafe', 3, full)).toBe(0);
    expect(noteXp([{ ...entry([0, 1, 2]), letterId: 'nt:market' }], 'nt:cafe', 3, full)).toBe(NOTE_XP);
  });
});
