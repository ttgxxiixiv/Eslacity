/**
 * Какие сквозные тесты гонять в CI (задача 20.6). Тесты, которые обходят весь контент языка (каждый урок, все
 * сцены, миссии, шёпоты, книги), помечены `@content` и `@<язык>`. Если коммиты меняют только контент одних языков
 * (и спутники выпуска: версию в package.json, список изменений, документы), хватает всех остальных тестов
 * и обхода этих языков. Любое другое изменение — полный прогон.
 */

/** Спутники выпуска: не код и не контент. package.json и lock-файл — только если поменялась лишь версия. */
const RELEASE_FILES = [/^docs\//, /^README\.md$/, /^CLAUDE\.md$/, /^src\/content\/changelog\.ts$/];

/**
 * `null` — полный прогон; иначе регулярное выражение для `--grep`: все тесты без `@content` и обход контента
 * изменённых языков. `versionOnly` — в package.json и package-lock.json поменялась только версия.
 */
export function e2eGrep(files: string[], langs: readonly string[], versionOnly: boolean): string | null {
  // Ничего не поменялось (повторный запуск той же версии) — проверяем целиком.
  if (!files.length) return null;
  const changed = new Set<string>();
  for (const f of files) {
    if (RELEASE_FILES.some((r) => r.test(f))) continue;
    if ((f === 'package.json' || f === 'package-lock.json') && versionOnly) continue;
    const m = f.match(/^src\/content\/([^/]+)\//);
    if (m && langs.includes(m[1])) {
      changed.add(m[1]);
      continue;
    }
    return null;
  }
  const only = langs.filter((l) => changed.has(l));
  return only.length ? `^(?!.*@content)|@content @(${only.join('|')})\\b` : '^(?!.*@content)';
}

/** Строки диффа package.json или lock-файла: правда, если меняется только поле version. */
export function onlyVersionChanged(diff: string): boolean {
  return diff
    .split('\n')
    .filter((l) => /^[+-](?![+-])/.test(l))
    .every((l) => /^[+-]\s*"version":\s*"[^"]*",?\s*$/.test(l));
}
