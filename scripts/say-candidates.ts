/**
 * Кандидаты на поле `say` (задача 15.4): аббревиатуры заглавными и числа в озвучиваемых текстах контента, которые
 * словарь произношения ещё не меняет. Печатает список по языкам; решать, нужен ли `say`, — человеку: годы и даты
 * синтез читает верно, «la UCI» прочтёт по буквам. Запуск: `npm run say`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildSayIndex, sayCandidates, sayRecords, spokenText } from '../src/domain/say';

const root = join(import.meta.dirname, '..', 'src', 'content');
/** Не озвучиваются: письма и записки игрок пишет сам. */
const SILENT = new Set(['letters.json']);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? files(full) : f.endsWith('.json') && !SILENT.has(f) ? [full] : [];
  });

/** Тексты на изучаемом языке: поле es у любой записи. */
function texts(data: unknown): string[] {
  const out: string[] = [];
  const visit = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(visit);
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if (typeof o.es === 'string') out.push(o.es);
    Object.values(o).forEach(visit);
  };
  visit(data);
  return out;
}

for (const lang of readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory() && /^[a-z]{2}$/.test(d))) {
  const all = files(join(root, lang)).map((f) => ({ f, data: JSON.parse(readFileSync(f, 'utf8')) as unknown }));
  const index = buildSayIndex(all.flatMap(({ data }) => sayRecords(data)));
  const found: string[] = [];
  for (const { f, data } of all) {
    for (const text of new Set(texts(data))) {
      const spoken = spokenText(text, index);
      const left = sayCandidates(spoken).filter((c) => text.includes(c));
      if (left.length) found.push(`  ${relative(root, f)}: ${left.join(', ')} — «${text.length > 90 ? `${text.slice(0, 90)}…` : text}»`);
    }
  }
  console.log(`${lang}: в словаре ${Object.keys(index.whole).length} записей, ${index.tokens.length} частей слов; без say — ${found.length}`);
  for (const line of found) console.log(line);
}
