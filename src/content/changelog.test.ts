import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANGELOG } from './changelog';

describe('журнал изменений', () => {
  it('первая запись совпадает с версией в package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(CHANGELOG[0].version).toBe(pkg.version);
  });
  it('версии идут по убыванию и не повторяются', () => {
    const v = CHANGELOG.map((r) => r.version);
    expect(new Set(v).size).toBe(v.length);
    const num = (s: string) => s.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0);
    for (let i = 1; i < v.length; i++) expect(num(v[i - 1])).toBeGreaterThan(num(v[i]));
  });
});
