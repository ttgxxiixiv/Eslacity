import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LocationScenes, Scene } from '../content/schema';
import { LANG_IDS } from '../lang';
import { checkDictation, dictationId, dictationLines, pickDictation } from './dictation';

const scene = (lines: Scene['lines'], extra: Partial<Scene> = {}): Scene => ({ id: 'sc:cafe.2', chapter: 2, npc: 'lola', lines, questions: [], ...extra });

describe('диктант (задача 21.5)', () => {
  const s = scene([
    { who: 'lola', es: '¡Hola!', ru: 'Привет!' },
    { who: 'lola', es: 'Hoy el café está muy caliente.', ru: 'Сегодня кофе очень горячий.' },
    { who: 'hero', es: 'Un café con leche, por favor.', ru: 'Кофе с молоком, пожалуйста.' },
    { who: 'lola', es: 'Te lo traigo ahora mismo, viajero.', ru: 'Сейчас принесу.', if: { flag: 'drink', is: 'tea' } },
    { who: 'lola', es: 'Siéntate donde quieras.', ru: 'Садись, где хочешь.' },
  ]);

  it('реплики жителя дослушанного разговора, без условий и коротких', () => {
    expect(dictationLines([s], new Set(), 'es')).toEqual([]);
    const lines = dictationLines([s], new Set(['sc:cafe.2']), 'es');
    expect(lines.map((l) => l.index)).toEqual([1, 4]);
    expect(dictationId(lines[0])).toBe('sc:cafe.2#1');
    expect(dictationLines([{ ...s, id: 'wh:cafe.4', mode: 'overhear' }], new Set(['wh:cafe.4']), 'es')).toEqual([]);
    expect(pickDictation(lines, 0.99)?.index).toBe(4);
    expect(pickDictation([], 0.5)).toBeUndefined();
  });

  it('проверка: вердикт фразы и пропущенные слова', () => {
    const text = 'Hoy el café está muy caliente.';
    const ok = checkDictation('hoy el café está muy caliente', text, 'es');
    expect(ok.verdict).toBe('correct');
    expect(ok.words.every((w) => w.ok)).toBe(true);
    expect(checkDictation('hoy el cafe esta muy caliente', text, 'es').verdict).toBe('almost');
    const miss = checkDictation('hoy café esta caliente', text, 'es');
    expect(miss.verdict).toBe('wrong');
    expect(miss.words.filter((w) => !w.ok).map((w) => w.text)).toEqual(['el', 'muy']);
    expect(miss.words.map((w) => w.text)).toEqual(['Hoy', 'el', 'café', 'está', 'muy', 'caliente.']);
    // Неверное слово — тоже не найдено.
    expect(checkDictation('hoy el té está muy caliente', text, 'es').words.filter((w) => !w.ok).map((w) => w.text)).toEqual(['café']);
  });

  it('сокращения английского: «don’t» равно «do not»', () => {
    const r = checkDictation('I do not know where it is', "I don't know where it is.", 'en');
    expect(r.words.every((w) => w.ok)).toBe(true);
  });

  it('у жителя каждого места с разговорами есть реплики для диктанта', () => {
    for (const lang of LANG_IDS) {
      const dir = join(import.meta.dirname, '..', 'content', lang, 'scenes');
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'thread.json')) {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as LocationScenes;
        const scenes = data.scenes.filter((x) => !x.mode);
        const lines = dictationLines(scenes, new Set(scenes.map((x) => x.id)), lang);
        expect(lines.length, `${lang}/${f}`).toBeGreaterThanOrEqual(scenes.length);
      }
    }
  });
});
