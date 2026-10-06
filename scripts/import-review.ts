/**
 * Загрузка правок носителя (задача 11.3): исправления из CSV выгрузки (`npm run review:export`) применяются
 * по адресу строки, после этого запускаются валидатор и тесты контента.
 *
 *   npx tsx scripts/import-review.ts review/es/sphinx.csv [review/es/words.csv …]
 *   npx tsx scripts/import-review.ts --lang it ~/Downloads/правки.csv
 *   npx tsx scripts/import-review.ts review/es/*.csv --dry-run     # только отчёт, файлы не меняются
 *
 * Язык — из папки CSV (`review/es/…`) или ключом `--lang`. Правка применяется, только если в контенте всё ещё
 * тот текст, что видел носитель; иначе она идёт в отчёт как пропущенная. Отчёт — `review/<язык>/applied-<время>.md`.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { applyFixes, fixesFromCsv, type FixResult, type ReviewFix } from './review-lib';

const ROOT = join(import.meta.dirname, '..');

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const langAt = args.indexOf('--lang');
  const forced = langAt >= 0 ? args[langAt + 1] : undefined;
  const csvs = args.filter((a, i) => a.endsWith('.csv') && !(langAt >= 0 && i === langAt + 1));
  if (!csvs.length) throw new Error('укажите CSV с правками');

  const byLang = new Map<string, ReviewFix[]>();
  for (const csv of csvs) {
    const lang = forced ?? basename(dirname(csv));
    if (lang !== 'es' && lang !== 'it') throw new Error(`${csv}: язык не понятен из папки, укажите --lang es или --lang it`);
    const fixes = fixesFromCsv(readFileSync(csv, 'utf8'));
    byLang.set(lang, [...(byLang.get(lang) ?? []), ...fixes]);
  }

  let failed = false;
  for (const [lang, fixes] of byLang) {
    const results: FixResult[] = [];
    const byFile = new Map<string, ReviewFix[]>();
    for (const f of fixes) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
    for (const [file, list] of byFile) {
      const path = join(ROOT, 'src', 'content', lang, file);
      if (file.includes('..') || !existsSync(path)) {
        results.push(...list.map((fix) => ({ ok: false as const, fix, reason: 'нет такой строки' as const })));
        continue;
      }
      const r = applyFixes(readFileSync(path, 'utf8'), list);
      results.push(...r.results);
      if (!dry && r.results.some((x) => x.ok)) writeFileSync(path, r.text);
    }
    const done = results.filter((r) => r.ok);
    const skipped = results.filter((r): r is Extract<FixResult, { ok: false }> => !r.ok);
    const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const report = [
      `# Правки носителя: ${lang}${dry ? ' (пробный прогон, файлы не менялись)' : ''}`,
      '',
      `Применено: ${done.length}, пропущено: ${skipped.length}.`,
      '',
      '| Файл | Путь | Было | Стало | Комментарий |',
      '|---|---|---|---|---|',
      ...done.map(({ fix: f }) => `| ${f.file} | ${f.path} | ${cell(f.text)} | ${cell(f.fix)} | ${cell(f.comment)} |`),
      ...(skipped.length
        ? ['', '## Пропущено', '', '| Файл | Путь | Почему | Правка |', '|---|---|---|---|', ...skipped.map((s) => `| ${s.fix.file} | ${s.fix.path} | ${s.reason} | ${cell(s.fix.fix)} |`)]
        : []),
      '',
    ].join('\n');
    const dir = join(ROOT, 'review', lang);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `applied-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`);
    writeFileSync(out, report);
    console.log(`${lang}: применено ${done.length}, пропущено ${skipped.length} → ${out.slice(ROOT.length + 1)}`);
    for (const s of skipped) console.log(`  пропущено: ${s.fix.file} ${s.fix.path} — ${s.reason}`);
  }

  if (dry) return;
  // После правок — валидатор и тесты контента: правка ответа может сломать варианты упражнения или плитки.
  // Предупреждения валидатора тоже не годятся: контент проходит проверку без ошибок и предупреждений.
  for (const cmd of ['npm run validate', 'npx vitest run src/content scripts']) {
    console.log(`\n> ${cmd}`);
    let out = '';
    try {
      out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = `${(e as { stdout?: string }).stdout ?? ''}${(e as { stderr?: string }).stderr ?? ''}`;
      failed = true;
    }
    console.log(out.trim());
    const warn = /предупреждений: (\d+)/.exec(out);
    if (warn && Number(warn[1]) > 0) failed = true;
  }
  if (failed) {
    console.error('\nПосле правок есть ошибки или предупреждения: посмотрите вывод выше и поправьте вручную или отмените (git checkout src/content).');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
