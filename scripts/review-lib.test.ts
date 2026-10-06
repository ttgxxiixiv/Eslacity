import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportLang } from './export-review';
import { applyFixes, extractRows, fixesFromCsv, getAt, locateStrings, parseCsv, REVIEW_TYPES, setAt, toCsv, typeOf } from './review-lib';

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

describe('загрузка правок носителя', () => {
  const file = `{
  "words": [
    { "id": "cafe.te", "es": "el te", "ru": "чай", "example": {"es": "Un té, \\"por\\" favor.", "ru": "Чай."} },
    {"id":"cafe.cafe","es":"el café","alt":["café"]}
  ]
}
`;

  it('место строки находится по адресу, кавычки внутри строки не мешают', () => {
    const spans = locateStrings(file);
    const at = (p: string) => JSON.parse(file.slice(...spans.get(p)!));
    expect(at('words/0/es')).toBe('el te');
    expect(at('words/0/example/es')).toBe('Un té, "por" favor.');
    expect(at('words/1/alt/0')).toBe('café');
  });

  it('правка меняет только свою строку; устаревшая, чужая и пустая правка пропускаются', () => {
    const fix = (path: string, text: string, to: string) => ({ file: 'words/cafe.json', path, text, fix: to, comment: '' });
    const r = applyFixes(file, [
      fix('words/0/es', 'el te', 'el té'),
      fix('words/1/alt/0', 'café', 'un café'),
      fix('words/1/es', 'el cafe', 'el café solo'),
      fix('words/9/es', 'x', 'y'),
      fix('words/0/example/es', 'Un té, "por" favor.', 'Un té, "por" favor.'),
    ]);
    expect(r.results.map((x) => (x.ok ? 'ok' : x.reason))).toEqual(['ok', 'ok', 'текст уже изменился', 'нет такой строки', 'правка совпадает с текстом']);
    expect(r.text).toBe(file.replace('"el te"', '"el té"').replace('["café"]', '["un café"]'));
  });

  it('правки берутся из CSV только там, где заполнен fix', () => {
    const csv = toCsv([
      ['file', 'path', 'id', 'level', 'ru', 'text', 'fix', 'comment'],
      ['words/cafe.json', 'words/0/es', 'cafe.te', 'A1', 'чай', 'el te', ' el té ', 'ударение'],
      ['words/cafe.json', 'words/1/es', 'cafe.cafe', 'A1', 'кофе', 'el café', '', ''],
    ]);
    expect(fixesFromCsv(csv)).toEqual([{ file: 'words/cafe.json', path: 'words/0/es', text: 'el te', fix: 'el té', comment: 'ударение' }]);
    expect(() => fixesFromCsv('a,b\n1,2\n')).toThrow(/не выгрузка/);
  });

  it('на всём контенте место каждой строки выгрузки совпадает с её текстом', () => {
    for (const lang of ['es', 'it']) {
      const texts = new Map<string, Map<string, [number, number]> & { src?: string }>();
      for (const rows of exportLang(lang).values()) {
        for (const r of rows) {
          let spans = texts.get(r.file);
          if (!spans) {
            const src = readFileSync(join(CONTENT, lang, r.file), 'utf8');
            spans = Object.assign(locateStrings(src), { src });
            texts.set(r.file, spans);
          }
          const at = spans.get(r.path);
          expect(at, `${lang} ${r.file} ${r.path}`).toBeDefined();
          expect(JSON.parse(spans.src!.slice(...at!))).toBe(r.text);
        }
      }
    }
  });
});
