import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateChronicler, validateGrammar, validateNpcs, validateScrolls, validateWords, type Issue } from '../src/content/validate';
import type { Chronicler, NpcsFile, ScrollFile } from '../src/content/schema';
import type { Lang } from '../src/lang';
import { PLAN_TOTAL } from '../src/content/vocabPlan';

const root = join(import.meta.dirname, '..', 'src', 'content');

function readJson<T>(dir: string): { name: string; data: T }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((name) => {
      try {
        return { name, data: JSON.parse(readFileSync(join(dir, name), 'utf8')) as T };
      } catch (e) {
        console.error(`✗ ${name}: невалидный JSON: ${(e as Error).message}`);
        process.exit(1);
      }
    });
}

const issues: Issue[] = [];
const summary: string[] = [];
const langs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'words')))
  .map((e) => e.name as Lang);

for (const lang of langs) {
  const words = readJson<Parameters<typeof validateWords>[0][number]['data']>(join(root, lang, 'words'));
  const grammarDir = join(root, lang, 'grammar');
  const grammar = existsSync(grammarDir)
    ? readdirSync(grammarDir).flatMap((d) =>
        readJson<Parameters<typeof validateGrammar>[0][number]['data']>(join(grammarDir, d)).map((f) => ({
          ...f,
          name: `${d}/${f.name}`,
        })),
      )
    : [];
  const tag = (list: Issue[]) => list.map((i) => ({ ...i, where: `${lang}/${i.where}` }));
  const npcsPath = join(root, lang, 'npcs.json');
  const npcs = existsSync(npcsPath) ? (JSON.parse(readFileSync(npcsPath, 'utf8')) as NpcsFile) : undefined;
  const scrolls = readJson<ScrollFile>(join(root, lang, 'scrolls'));
  const chroniclerPath = join(root, lang, 'chronicler.json');
  const chronicler = existsSync(chroniclerPath) ? (JSON.parse(readFileSync(chroniclerPath, 'utf8')) as Chronicler) : undefined;
  issues.push(
    ...tag(validateWords(words, lang)),
    ...tag(validateScrolls(scrolls, words, lang)),
    ...tag(validateGrammar(grammar, lang)),
    ...tag(validateNpcs(npcs)),
    ...tag(validateChronicler(chronicler, npcs)),
  );
  const placeCount = words.reduce((n, f) => n + f.data.words.length, 0);
  const scrollCount = scrolls.reduce((n, f) => n + f.data.words.length, 0);
  summary.push(
    `${lang}: ${words.length} локаций, слов: ${placeCount + scrollCount} (из них в свитках ${scrollCount}) из плана ${PLAN_TOTAL}, ${grammar.length} уроков, ${npcs?.npcs.length ?? 0} жителей`,
  );
}

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

for (const i of warnings) console.warn(`⚠ ${i.where}: ${i.msg}`);
for (const i of errors) console.error(`✗ ${i.where}: ${i.msg}`);

console.log(`Контент: ${summary.join('; ')}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
