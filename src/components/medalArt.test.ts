import { describe, expect, it } from 'vitest';
import { LINES, TIERS } from '../domain/medals';
import { medalPixels, PALETTES } from './medalArt';

describe('рисунок медали', () => {
  it('у каждой линии свой значок, все точки внутри 16×16', () => {
    const seen = new Set<string>();
    for (const l of LINES) {
      const px = medalPixels(l.id, 'gold');
      expect(px.every((p) => p.x >= 0 && p.x < 16 && p.y >= 0 && p.y < 16)).toBe(true);
      seen.add(px.filter((p) => p.fill === PALETTES.gold.I).map((p) => `${p.x}.${p.y}`).join());
    }
    expect(seen.size).toBe(LINES.length);
  });

  it('ступени различаются цветом, силуэт без цветов ступеней', () => {
    const colors = (t: (typeof TIERS)[number] | null) => new Set(medalPixels('words', t).map((p) => p.fill));
    for (const t of TIERS) expect(colors(t).has(PALETTES[t].F)).toBe(true);
    const locked = colors(null);
    for (const t of TIERS) expect(locked.has(PALETTES[t].F)).toBe(false);
  });

  it('искры есть только у бриллианта', () => {
    expect(medalPixels('words', 'diamond').filter((p) => p.sparkle)).toHaveLength(3);
    for (const t of [...TIERS.slice(0, 5), null]) expect(medalPixels('words', t).some((p) => p.sparkle)).toBe(false);
  });
});
