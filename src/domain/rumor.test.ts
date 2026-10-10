import { describe, expect, it } from 'vitest';
import type { Rumor, Word } from '../content/schema';
import { validateRumors } from '../content/validate';
import { seeded } from './generators';
import { buildRumorEvent, catWord, nextRumor, RUMOR_KINDS, RUMOR_MIN_WORDS, rumorCoins, rumorDue, rumorKind, rumorRight } from './rumor';

const word = (id: string, es: string, ru: string, extra: Partial<Word> = {}): Word =>
  ({ id: `cafe.${id}`, es, ru, pos: 'noun', gender: 'm', level: 1, cefr: 'A1', example: { es: `Ejemplo ${id}.`, ru: `Пример ${id}.` }, ...extra }) as Word;

const POOL: Word[] = [
  word('cafe', 'el café', 'кофе'),
  word('te', 'el té', 'чай'),
  word('azucar', 'el azúcar', 'сахар'),
  word('leche', 'la leche', 'молоко'),
  word('agua', 'el agua', 'вода'),
  word('zumo', 'el zumo', 'сок'),
  word('pan', 'el pan', 'хлеб'),
  word('mesa', 'la mesa', 'стол'),
  word('silla', 'la silla', 'стул'),
];

describe('слухи города: событие дня', () => {
  it('вид события идёт по кругу по дням', () => {
    expect([0, 1, 2, 3].map(rumorKind)).toEqual(['guest', 'cat', 'notice', 'guest']);
    expect(rumorKind(-1)).toBe('notice');
  });

  it('мало слов — события нет; выражения не берутся', () => {
    expect(buildRumorEvent('guest', POOL.slice(0, RUMOR_MIN_WORDS - 1), seeded(1))).toBeNull();
    const withExpr = [...POOL.slice(0, RUMOR_MIN_WORDS - 1), word('x', 'echar una mano', 'помочь', { kind: 'idiom', register: 'informal' })];
    expect(buildRumorEvent('guest', withExpr, seeded(1))).toBeNull();
  });

  it('гость и объявление: четыре разных варианта, верный среди них', () => {
    for (let s = 1; s < 30; s++) {
      for (const kind of ['guest', 'notice'] as const) {
        const ev = buildRumorEvent(kind, POOL, seeded(s))!;
        expect(ev.kind).toBe(kind);
        if (ev.kind === 'cat') throw new Error('не тот вид');
        expect(new Set(ev.options).size).toBe(4);
        expect(ev.options).toContain(ev.answer);
        expect(ev.answer).toBe(kind === 'guest' ? ev.word.ru : ev.word.example.ru);
        expect(rumorRight(ev, ev.answer)).toBe(true);
        expect(rumorRight(ev, ev.options.find((o) => o !== ev.answer)!)).toBe(false);
      }
    }
  });

  it('кот: слово без артикля из 4–9 букв, буквы перемешаны', () => {
    expect(catWord(POOL[0])).toBe('café');
    expect(catWord(POOL[1])).toBeNull(); // té — короче четырёх
    expect(catWord({ ...POOL[0], usage: 'vulgar', usageNote: 'грубое' })).toBeNull(); // грубое не собираем (15.2)
    expect(catWord(word('x', 'el abrelatas grande', 'открывалка'))).toBeNull();
    expect(catWord(word('y', 'la contraseña', 'пароль'))).toBeNull(); // 10 букв
    for (let s = 1; s < 30; s++) {
      const ev = buildRumorEvent('cat', POOL, seeded(s))!;
      if (ev.kind !== 'cat') throw new Error('не тот вид');
      expect([...ev.letters].sort()).toEqual([...ev.answer].sort());
      expect(ev.letters.join('')).not.toBe(ev.answer);
      expect(rumorRight(ev, ev.answer.toUpperCase())).toBe(true);
    }
  });

  it('монеты растут с главой, событие раз в день', () => {
    expect(rumorCoins(1)).toBe(15);
    expect(rumorCoins(3)).toBe(45);
    expect(rumorDue({ got: [] }, 10)).toBe(true);
    expect(rumorDue({ day: 10, got: [] }, 10)).toBe(false);
    expect(rumorDue({ day: 9, got: [] }, 10)).toBe(true);
    expect(RUMOR_KINDS).toHaveLength(3);
  });

  it('следующий слух: открытые главы по порядку, полученные пропускаются', () => {
    const r = (id: string, chapter: number): Rumor => ({ id, chapter, who: 'lola', es: 'Hola.', ru: 'Привет.' });
    const all = [r('rm:2.1', 2), r('rm:1.1', 1), r('rm:1.2', 1)];
    expect(nextRumor(all, [], 1)?.id).toBe('rm:1.1');
    expect(nextRumor(all, ['rm:1.1'], 1)?.id).toBe('rm:1.2');
    expect(nextRumor(all, ['rm:1.1', 'rm:1.2'], 1)).toBeNull();
    expect(nextRumor(all, ['rm:1.1', 'rm:1.2'], 2)?.id).toBe('rm:2.1');
  });
});

describe('validateRumors', () => {
  const ok = (ch: number, n: number) => ({ id: `rm:${ch}.${n}`, chapter: ch, who: 'lola', es: 'Hola, amigo.', ru: 'Привет, друг.' });
  const full = () => [1, 2, 3, 4, 5].flatMap((ch) => [1, 2, 3, 4].map((n) => ok(ch, n)));
  const run = (rumors: ReturnType<typeof ok>[]) => validateRumors({ rumors }, new Set(['lola'])).map((i) => i.msg);

  it('полный файл без ошибок', () => {
    expect(run(full())).toEqual([]);
  });

  it('id, житель, язык, число на главу', () => {
    const rs = full();
    rs[0] = { ...rs[0], id: 'rm:2.9' };
    rs[1] = { ...rs[1], who: 'nadie' };
    rs[2] = { ...rs[2], es: 'Привет' };
    expect(run(rs)).toEqual(['id должен быть rm:<глава>.<n>', 'неизвестный житель "nadie"', 'реплика не на изучаемом языке']);
    expect(run(full().slice(1))).toEqual(['слухов главы 1: 3, нужно не меньше 4']);
    expect(validateRumors(undefined, new Set()).map((i) => i.msg)).toEqual(['нет файла слухов']);
  });
});
