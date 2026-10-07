import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../domain/chiptune';
import TRACKS from './tracks.json';

/** Записанные темы (scripts/build-music.py): у каждой есть файл, кольцо внутри записи и после вступления. */
describe('записанные темы', () => {
  const tracks = Object.entries(TRACKS) as [string, { loopStart: number; loopEnd: number }][];

  it('есть хотя бы тема города', () => {
    expect(tracks.map(([id]) => id)).toContain('city');
  });

  it.each(tracks)('%s: тема из THEMES, файл на месте, кольцо не короче 30 секунд', (id, loop) => {
    expect(Object.keys(THEMES)).toContain(id);
    const file = join(import.meta.dirname, '..', '..', 'public', 'music', `${id}.ogg`);
    expect(existsSync(file)).toBe(true);
    // Около мегабайта на тему: больше — повод снизить битрейт.
    expect(statSync(file).size).toBeLessThan(2.5 * 1024 * 1024);
    expect(loop.loopStart).toBeGreaterThan(1.5);
    expect(loop.loopEnd - loop.loopStart).toBeGreaterThan(30);
  });
});
