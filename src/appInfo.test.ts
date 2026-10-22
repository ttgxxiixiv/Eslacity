import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, appDescription } from './appInfo';
import { LANGS, RELEASED_LANGS } from './lang';

const root = join(import.meta.dirname, '..');

describe('имя и описание приложения (задача 20.1)', () => {
  it('описание перечисляет открытые курсы', () => {
    expect(appDescription(['Испанский'])).toBe('Испанский для русскоговорящих: строй город, учи слова и грамматику');
    expect(appDescription(['Испанский', 'Итальянский', 'Английский'])).toMatch(/^Испанский, итальянский и английский для русскоговорящих/);
    const text = appDescription(RELEASED_LANGS.map((l) => LANGS[l].name)).toLowerCase();
    for (const l of RELEASED_LANGS) expect(text).toContain(LANGS[l].name.toLowerCase());
  });

  it('имя не привязано к одному языку', () => {
    for (const l of Object.values(LANGS)) expect(APP_NAME.toLowerCase()).not.toContain(l.name.toLowerCase());
  });

  it('index.html и манифест берут описание из appInfo, а не строкой', () => {
    expect(readFileSync(join(root, 'index.html'), 'utf8')).toContain('content="%APP_DESCRIPTION%"');
    const config = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    expect(config).toContain('name: APP_NAME');
    expect(config).toContain('description: APP_DESCRIPTION');
  });
});
