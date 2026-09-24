import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateGrammar, validateWords, type Issue } from '../src/content/validate';

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

const words = readJson<Parameters<typeof validateWords>[0][number]['data']>(join(root, 'words'));
const grammarDir = join(root, 'grammar');
const grammar = existsSync(grammarDir)
  ? readdirSync(grammarDir).flatMap((d) =>
      readJson<Parameters<typeof validateGrammar>[0][number]['data']>(join(grammarDir, d)).map((f) => ({
        ...f,
        name: `${d}/${f.name}`,
      })),
    )
  : [];

const issues: Issue[] = [...validateWords(words), ...validateGrammar(grammar)];
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

for (const i of warnings) console.warn(`⚠ ${i.where}: ${i.msg}`);
for (const i of errors) console.error(`✗ ${i.where}: ${i.msg}`);

const wordCount = words.reduce((n, f) => n + f.data.words.length, 0);
console.log(
  `Контент: ${words.length} локаций, ${wordCount} слов, ${grammar.length} уроков грамматики. ` +
    `Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`,
);
process.exit(errors.length ? 1 : 0);
