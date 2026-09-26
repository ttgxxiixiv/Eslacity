import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NpcsFile } from '../content/schema';
import { NPC_H, NPC_W, npcPixels } from './npcArt';

const load = (lang: string) => (JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', lang, 'npcs.json'), 'utf8')) as NpcsFile).npcs;

describe('портреты жителей', () => {
  it('все точки внутри 14×18, у каждого жителя языка свой портрет', () => {
    for (const lang of ['es', 'it']) {
      const seen = new Set<string>();
      for (const n of load(lang)) {
        const px = npcPixels(n.look);
        expect(px.every((p) => p.x >= 0 && p.x < NPC_W && p.y >= 0 && p.y < NPC_H)).toBe(true);
        seen.add(JSON.stringify(px));
      }
      expect(seen.size).toBe(20);
    }
  });
  it('детали меняют рисунок: очки, колпак, фартук', () => {
    const base = { skin: 2, hair: '#3b2a1a', style: 'short', outfit: '#2d5596', pants: '#2d2d3a', extra: [] } as const;
    const plain = JSON.stringify(npcPixels({ ...base, extra: [] }));
    for (const e of ['glasses', 'chefhat', 'apron'] as const) expect(JSON.stringify(npcPixels({ ...base, extra: [e] }))).not.toBe(plain);
  });
});
