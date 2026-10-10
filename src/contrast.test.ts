import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Читаемость (задача 14.3): цвета текста из `@theme` в `index.css` на светлых фонах пергамента дают контраст не ниже
 * 4.5 (WCAG AA для основного текста), в коде нет текста мельче 12 px и бледного `text-stone-400`.
 */

const SRC = join(import.meta.dirname);
const css = readFileSync(join(SRC, 'index.css'), 'utf8');
const theme = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const page = css.match(/html\s*\{[^}]*background:\s*(#[0-9a-f]{6})/i)![1];

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Цвета основного текста и светлые фоны, на которых он стоит. */
const TEXT = ['stone-500', 'stone-600', 'stone-700', 'stone-800', 'stone-900', 'brand', 'ok', 'bad', 'almost', 'amber-700'];
const LIGHT = { white: theme.white, 'stone-50': theme['stone-50'], 'stone-100': theme['stone-100'], 'orange-50': theme['orange-50'], page };

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|ts)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('контраст и размер текста', () => {
  it('токены прочитаны', () => {
    for (const t of TEXT) expect(theme[t], t).toMatch(/^#/);
    expect(page).toMatch(/^#/);
  });

  for (const t of TEXT) {
    it(`${t} на светлых фонах — не ниже 4.5`, () => {
      for (const [name, bg] of Object.entries(LIGHT)) expect(contrast(theme[t], bg), `${t} на ${name}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('итог ответа: цвет на своём фоне', () => {
    expect(contrast(theme.ok, theme.okbg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.bad, theme.badbg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.almost, theme.almostbg)).toBeGreaterThanOrEqual(4.5);
  });

  it('в коде нет текста мельче 12 px и бледного text-stone-400', () => {
    const bad: string[] = [];
    for (const f of files(SRC)) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) bad.push(`${f}: ${m[0]}`);
      if (text.includes('text-stone-400')) bad.push(`${f}: text-stone-400`);
    }
    expect(bad).toEqual([]);
  });

  it('проверка ловит бледный цвет', () => {
    expect(contrast('#93754d', page)).toBeLessThan(4.5);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
