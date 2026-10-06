import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportLang } from './export-review';
import { extractRows, getAt, parseCsv, REVIEW_TYPES, setAt, toCsv, typeOf } from './review-lib';

const CONTENT = join(import.meta.dirname, '..', 'src', 'content');

describe('выгрузка на вычитку', () => {
  it('слово: форма и пример со своим переводом, русское не выгружается', () => {
    const rows = extractRows('words/cafe.json', {
      location: 'cafe',
      words: [{ id: 'cafe.te', es: 'el té', ru: 'чай', pos: 'noun', level: 1, cefr: 'A1', alt: ['té'], example: { es: 'Un té, por favor.', ru: 'Чай, пожалуйста.' } }],
    });
    expect(rows.map((r) => [r.path, r.text, r.ru, r.id, r.level])).toEqual([
      ['words/0/es', 'el té', 'чай', 'cafe.te', 'A1'],
      ['words/0/alt/0', 'té', 'чай', 'cafe.te', 'A1'],
      ['words/0/example/es', 'Un té, por favor.', 'Чай, пожалуйста.', 'cafe.te', 'A1'],
    ]);
  });

  it('упражнение: номер ответа и русская теория без примеров не выгружаются, вопросы сцены тоже', () => {
    const g = extractRows('grammar/a1/02-ser.json', {
      id: 'a1.02-ser', district: 'a1', title: 'Ser', theory: [{ kind: 'text', md: 'Глагол неправильный.' }, { kind: 'text', md: 'Например, soy.' }],
      exercises: [{ id: 'a1.02-ser.3', kind: 'gap', sentence: 'Tú ___ mi amigo.', ru: 'Ты мой друг.', options: ['eres', 'es'], answer: 0, explain: 'tú eres.' }],
    });
    expect(g.map((r) => r.path)).toEqual(['theory/1/md', 'exercises/0/sentence', 'exercises/0/options/0', 'exercises/0/options/1', 'exercises/0/explain']);
    const sc = extractRows('scenes/cafe.json', { scenes: [{ id: 'sc:cafe.1', lines: [{ who: 'npc', es: 'Hola', ru: 'Привет', fem: { es: 'Hola, guapa' } }], questions: [{ q: 'Кто?', options: ['Лола'], answer: 0 }], gloss: { hola: 'привет' } }] });
    expect(sc.map((r) => [r.path, r.text])).toEqual([['scenes/0/lines/0/es', 'Hola'], ['scenes/0/lines/0/fem/es', 'Hola, guapa']]);
  });

  it('вид по файлу: у праздника слова, фразы и миссия идут в свои таблицы', () => {
    expect(typeOf('festivals/sanfermin.json', 'words/0/es')).toBe('words');
    expect(typeOf('festivals/sanfermin.json', 'missions/0/nodes/hi/es')).toBe('missions');
    expect(typeOf('scrolls/1.json', 'words/0/es')).toBe('words');
    expect(typeOf('sphinx.json', 'wisdom/0/title')).toBe('sphinx');
  });

  it('CSV: запятые, кавычки, переводы строк туда и обратно; русский Excel с «;»', () => {
    const rows = [['a', 'b'], ['x, y', 'он сказал "да"\nи ушёл']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(parseCsv('﻿file;fix\r\nwords/cafe.json;"el té; caliente"\r\n')).toEqual([['file', 'fix'], ['words/cafe.json', 'el té; caliente']]);
  });

  it('адрес каждой строки выгрузки ведёт к её тексту в JSON — правку можно вернуть на место', () => {
    for (const lang of ['es', 'it']) {
      const byType = exportLang(lang);
      for (const t of REVIEW_TYPES) expect(byType.get(t)!.length, `${lang} ${t}`).toBeGreaterThan(0);
      const cache = new Map<string, unknown>();
      for (const rows of byType.values()) {
        for (const r of rows) {
          if (!cache.has(r.file)) cache.set(r.file, JSON.parse(readFileSync(join(CONTENT, lang, r.file), 'utf8')));
          expect(getAt(cache.get(r.file), r.path), `${lang} ${r.file} ${r.path}`).toBe(r.text);
        }
      }
    }
  });

  it('запись по адресу: только существующее поле', () => {
    const d = { words: [{ es: 'el te' }] };
    expect(setAt(d, 'words/0/es', 'el té')).toBe(true);
    expect(d.words[0].es).toBe('el té');
    expect(setAt(d, 'words/0/new', 'x')).toBe(false);
    expect(setAt(d, 'words/5/es', 'x')).toBe(false);
  });
});
