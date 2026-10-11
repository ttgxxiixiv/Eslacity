import { describe, expect, it } from 'vitest';
import { eager, loader, loaders, parseContentPath, type EagerKind, type LazyKind } from './registry';

const LAZY: LazyKind[] = ['words', 'scrolls', 'festivals', 'books', 'phrases', 'missions', 'scenes', 'grammar', 'sphinx', 'letters', 'rumors', 'verbs', 'pairs'];
const EAGER: EagerKind[] = ['npcs', 'chronicler', 'guardians', 'diary', 'prologue'];

describe('реестр контента (задача 16.5)', () => {
  it('ключ файла по пути', () => {
    expect(parseContentPath('./es/words/cafe.json', 'words')).toEqual({ lang: 'es', key: 'cafe' });
    expect(parseContentPath('./it/grammar/a1/02-essere.json', 'grammar')).toEqual({ lang: 'it', key: 'a1/02-essere' });
    expect(parseContentPath('./es/sphinx.json', 'sphinx')).toEqual({ lang: 'es', key: '' });
    expect(parseContentPath('./es/scenes/cafe.json', 'words')).toBeNull();
  });

  it('у каждого вида есть файлы обоих языков, ключи без языка и расширения', () => {
    for (const lang of ['es', 'it'] as const) {
      for (const kind of LAZY) expect(loaders(kind, lang).size, `${lang}/${kind}`).toBeGreaterThan(0);
      for (const kind of EAGER) expect(eager(kind, lang), `${lang}/${kind}`).toBeDefined();
      expect(loaders('words', lang).has('cafe')).toBe(true);
      expect([...loaders('scrolls', lang).keys()].sort()).toEqual(['1', '2', '3', '4', '5']);
      expect(loader('sphinx', '', lang)).toBeDefined();
    }
    expect(loaders('grammar', 'es').has('a1/02-ser')).toBe(true);
  });

  it('загрузчик отдаёт файл своего языка', async () => {
    const es = await loader('words', 'cafe', 'es')!();
    const it = await loader('words', 'cafe', 'it')!();
    expect(es.location).toBe('cafe');
    expect(es.words[0].es).not.toBe(it.words[0].es);
  });
});
