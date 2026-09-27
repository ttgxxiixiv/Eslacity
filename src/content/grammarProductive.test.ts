import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from '../domain/generators';
import { checkGrammar, toItem } from '../domain/grammar';
import { phraseTokens } from '../domain/phraseSteps';
import type { GrammarLesson } from './schema';

/** Все уроки языка из контента. */
function lessons(lang: string): GrammarLesson[] {
  const root = join(import.meta.dirname, lang, 'grammar');
  return readdirSync(root).flatMap((d) =>
    readdirSync(join(root, d)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(root, d, f), 'utf8')) as GrammarLesson),
  );
}

/** Районы, где продуктивные задания уже написаны (задача 5.3 идёт пачками по району). */
const DONE = ['A1'];

describe.each(['es', 'it'])('продуктивные задания в контенте: %s', (lang) => {
  const all = lessons(lang);

  it('в готовых районах у каждого урока есть сборка и ввод формы', () => {
    for (const l of all.filter((x) => DONE.includes(x.district))) {
      const kinds = l.exercises.map((e) => e.kind);
      expect(kinds.filter((k) => k === 'build').length, l.id).toBeGreaterThanOrEqual(1);
      expect(kinds.filter((k) => k === 'type').length, l.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('ответ и каждый alt проходят проверку, лишние плитки ответ не собирают', () => {
    for (const l of all) {
      for (const ex of l.exercises) {
        if (ex.kind === 'build') {
          const item = toItem(ex, seeded(1));
          for (const a of [ex.answer, ...(ex.alt ?? [])]) {
            expect(checkGrammar(item, { tiles: phraseTokens(a) }).verdict, `${ex.id}: ${a}`).toBe('correct');
          }
          // Лишняя плитка вместо любого слова ответа — уже ошибка.
          const words = phraseTokens(ex.answer);
          for (const x of ex.extra) {
            expect(checkGrammar(item, { tiles: [x, ...words.slice(1)] }).verdict, `${ex.id}: ${x}`).toBe('wrong');
          }
        } else if (ex.kind === 'type') {
          const item = toItem(ex, seeded(1));
          for (const a of [ex.answer, ...(ex.alt ?? [])]) expect(checkGrammar(item, { text: a }).verdict, `${ex.id}: ${a}`).toBe('correct');
        }
      }
    }
  });
});
