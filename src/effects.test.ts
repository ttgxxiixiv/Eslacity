import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Все исходники приложения. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('эффекты React', () => {
  it('возвращают только функцию очистки: тело в скобках или () => () => …', () => {
    // Стрелка без скобок вернула бы значение выражения. В новом Chrome scrollIntoView возвращает Promise, и React
    // при уходе с экрана вызывал его как функцию очистки: «l is not a function» в конце миссии (2.113.3).
    const bad = sources(join(import.meta.dirname))
      .flatMap((p) =>
        readFileSync(p, 'utf8')
          .split('\n')
          .map((line, i) => ({ p, i: i + 1, line }))
          .filter(({ line }) => /use(Layout)?Effect\(\s*\(\)\s*=>\s*(?![{\s]|\(\)\s*=>)/.test(line)),
      )
      .map(({ p, i, line }) => `${p}:${i}: ${line.trim()}`);
    expect(bad).toEqual([]);
  });
});
