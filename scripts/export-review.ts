/**
 * Выгрузка контента на вычитку носителю (задача 11.2): CSV по языку и виду контента.
 *
 *   npx tsx scripts/export-review.ts                 # оба языка, все виды → review/<язык>/<вид>.csv
 *   npx tsx scripts/export-review.ts it sphinx words # только итальянский, Сфинкс и слова
 *   npx tsx scripts/export-review.ts --out /tmp/r    # другая папка
 *
 * Колонки: file, path — адрес строки в JSON (по нему 11.3 вернёт правку), id и level — где это в игре и какого
 * уровня, ru — что строка должна значить, text — как сейчас, fix — правка носителя, comment — его пояснение.
 * Строки в файле по уровню от сложного к простому: выражения C1 и Сфинкс носителю важнее всего.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CSV_COLUMNS, extractRows, REVIEW_TYPES, toCsv, type ReviewRow, type ReviewType } from './review-lib';

const ROOT = join(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'src', 'content');
const LANGS = ['es', 'it'] as const;

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

/** Сложное сверху: C1 и глава V, потом ниже; внутри — в порядке файлов. */
const RANK = ['C2', 'C1', 'глава 5', 'c1', 'B2', 'глава 4', 'b2', 'B1', 'глава 3', 'b1', 'A2', 'глава 2', 'a2', 'A1', 'глава 1', 'a1'];
const rank = (level: string) => {
  const i = RANK.indexOf(level);
  return i < 0 ? RANK.length : i;
};

export function exportLang(lang: string, types: readonly ReviewType[] = REVIEW_TYPES): Map<ReviewType, ReviewRow[]> {
  const base = join(CONTENT, lang);
  const byType = new Map<ReviewType, ReviewRow[]>(types.map((t) => [t, []]));
  for (const path of jsonFiles(base).sort()) {
    const file = relative(base, path).split('\\').join('/');
    for (const row of extractRows(file, JSON.parse(readFileSync(path, 'utf8')))) byType.get(row.type)?.push(row);
  }
  for (const rows of byType.values()) rows.sort((a, b) => rank(a.level) - rank(b.level));
  return byType;
}

function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf('--out');
  const out = outAt >= 0 ? args[outAt + 1] : join(ROOT, 'review');
  // Без --out аргументы все; с ним — без самого ключа и папки.
  const rest = outAt >= 0 ? args.filter((_, i) => i !== outAt && i !== outAt + 1) : args;
  const langs = LANGS.filter((l) => rest.includes(l));
  const types = REVIEW_TYPES.filter((t) => rest.includes(t));
  for (const lang of langs.length ? langs : LANGS) {
    const dir = join(out, lang);
    mkdirSync(dir, { recursive: true });
    const parts: string[] = [];
    for (const [type, rows] of exportLang(lang, types.length ? types : REVIEW_TYPES)) {
      writeFileSync(join(dir, `${type}.csv`), toCsv([[...CSV_COLUMNS], ...rows.map((r) => [r.file, r.path, r.id, r.level, r.ru, r.text, '', ''])]));
      parts.push(`${type} ${rows.length}`);
    }
    console.log(`${lang}: ${parts.join(', ')} → ${relative(ROOT, dir) || dir}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
