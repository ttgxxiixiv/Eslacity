import { describe, expect, it } from 'vitest';
import { e2eGrep, onlyVersionChanged } from './e2e-plan-lib';

const LANGS = ['es', 'it', 'en', 'tr', 'pt'];

describe('план сквозных тестов (задача 20.6)', () => {
  it('код — полный прогон', () => {
    expect(e2eGrep(['src/screens/Home.tsx'], LANGS, true)).toBeNull();
    expect(e2eGrep(['src/content/tr/words/cafe.json', 'src/domain/answer.ts'], LANGS, true)).toBeNull();
    expect(e2eGrep(['src/content/schema.ts'], LANGS, true)).toBeNull();
    expect(e2eGrep(['package.json'], LANGS, false)).toBeNull();
    expect(e2eGrep([], LANGS, true)).toBeNull();
  });

  it('контент одного языка и спутники выпуска — остальные тесты и обход этого языка', () => {
    const grep = e2eGrep(['src/content/tr/words/cafe.json', 'package.json', 'src/content/changelog.ts', 'docs/STAGES.md'], LANGS, true)!;
    const re = new RegExp(grep);
    expect(re.test('tr: урок a1.01 @content @tr')).toBe(true);
    expect(re.test('pt: урок a1.01 @content @pt')).toBe(false);
    expect(re.test('es урок a1.02-ser @content @es')).toBe(false);
    expect(re.test('es главная: панель и карта')).toBe(true);
  });

  it('только документы — без обхода контента', () => {
    const re = new RegExp(e2eGrep(['docs/ROADMAP.md'], LANGS, true)!);
    expect(re.test('tr: урок @content @tr')).toBe(false);
    expect(re.test('es главная')).toBe(true);
  });

  it('в package.json поменялась только версия', () => {
    expect(onlyVersionChanged('--- a/package.json\n+++ b/package.json\n@@ -3 +3 @@\n-  "version": "2.232.0",\n+  "version": "2.232.1",')).toBe(true);
    expect(onlyVersionChanged('@@ -20 +20 @@\n-    "zustand": "^5.0.0"\n+    "zustand": "^5.1.0"')).toBe(false);
  });
});
