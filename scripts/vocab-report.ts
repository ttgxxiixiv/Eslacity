/**
 * Отчёт о словаре курса (задача 0.4): `npm run vocab`.
 *
 * Печатает по каждому языку число слов по главам, уровням и CEFR, повторы лемм между местами
 * и покрытие первых 1000, 3000 и 5000 частотных слов. Пишет docs/vocab/<язык>.md: частотные слова,
 * которых нет в курсе, по полосам частоты. Список пересобирается командой, вручную его не правят.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GrammarLesson, LocationWords, ScrollFile } from '../src/content/schema';
import { CHAPTERS, COVERAGE_GOAL, PLAN_TOTAL, VOCAB_GOAL, chapterOfLevel } from '../src/content/vocabPlan';
import { chapterOfDistrict } from '../src/domain/chapters';
import { anywhereLemmas, applySkips, applySkipsToForms, BANDS, coverage, grammarLemmas, lemmaRanks, lemmasIn, median, parseFreq, parseLemmas, parseSkips, RARE_RANK, share, wordRank } from './vocab-lib';

const root = join(import.meta.dirname, '..');
const content = join(root, 'src', 'content');
const read = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const pct = (a: number, b: number) => `${Math.round((a / b) * 1000) / 10}%`;

function report(lang: string): string {
  const skips = parseSkips(readFileSync(join(root, 'scripts', 'data', `skip-${lang}.txt`), 'utf8'));
  // Поправки к списку (задача 12.1): ошибки лемматизации, имена и слова жанра субтитров — scripts/data/skip-<язык>.txt.
  const freq = applySkips(
    parseFreq(readFileSync(join(root, 'scripts', 'data', `freq-${lang}.tsv`), 'utf8')),
    skips,
  );
  const forms = applySkipsToForms(parseLemmas(readFileSync(join(root, 'scripts', 'data', `lemmas-${lang}.tsv`), 'utf8')), skips);
  const lem = (s: string) => lemmasIn(s, forms, lang);

  const files = readdirSync(join(content, lang, 'words'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => read<LocationWords>(join(content, lang, 'words', f)));
  // Выражения уровня 7 (задача 7.1) в число слов и повторы не входят, их леммы идут в «встречается в курсе».
  const all = files.flatMap((f) => f.words.map((w) => ({ ...w, place: f.location as string })));
  const placeWords = all.filter((w) => !w.kind);
  const expressions = all.filter((w) => w.kind);
  const scrollDir = join(content, lang, 'scrolls');
  const scrolls = existsSync(scrollDir)
    ? readdirSync(scrollDir).filter((f) => f.endsWith('.json')).map((f) => read<ScrollFile>(join(scrollDir, f)))
    : [];
  const scrollWords = scrolls.flatMap((f) => f.words.map((w) => ({ ...w, place: `scroll${f.chapter}` })));
  // Слова свитков считаются вместе со словами мест: покрытие, повторы, CEFR.
  const words = [...placeWords, ...scrollWords];

  const grammarDir = join(content, lang, 'grammar');
  const lessons = readdirSync(grammarDir).flatMap((d) =>
    readdirSync(join(grammarDir, d)).map((f) => read<GrammarLesson>(join(grammarDir, d, f))),
  );

  // Что считается выученным: слова мест целиком (и слова внутри фраз), формы из таблиц и вариантов ответа уроков.
  const wordSet = new Set(words.flatMap((w) => [w.es, ...(w.alt ?? [])].flatMap(lem)));
  const grammarSet = grammarLemmas(lessons, lem);
  const anywhere = anywhereLemmas([...words, ...expressions], lessons, lem);
  const cov = coverage(freq, { words: wordSet, grammar: grammarSet, anywhere });

  // Повторы: одна и та же лемма как отдельное слово в разных местах.
  const service = new Set(freq.filter((e) => e.service).map((e) => e.lemma));
  const byLemma = new Map<string, string[]>();
  for (const w of words) {
    const main = lem(w.es).filter((l) => !service.has(l));
    if (main.length !== 1) continue;
    byLemma.set(main[0], [...(byLemma.get(main[0]) ?? []), `${w.place}: ${w.es}`]);
  }
  const repeats = [...byLemma].filter(([, v]) => v.length > 1);

  const count = <K extends string | number>(key: (w: (typeof words)[number]) => K, list = words) => {
    const m = new Map<K, number>();
    for (const w of list) m.set(key(w), (m.get(key(w)) ?? 0) + 1);
    return [...m].sort(([a], [b]) => String(a).localeCompare(String(b)));
  };
  // Ранги слов (задача 12.1): медиана по уровням мест и свиткам, первая тысяча к концу каждой главы.
  const ranks = lemmaRanks(cov);
  const rankOf = (es: string) => wordRank(es, forms, lang, ranks);
  const chapterOf = (w: (typeof words)[number]) =>
    w.place.startsWith('scroll') ? Number(w.place.slice('scroll'.length)) : CHAPTERS.findIndex((c) => c.levels.includes(w.level)) + 1;
  const showRank = (r: number | undefined) => (r === undefined ? '—' : r === Infinity ? 'вне списка' : String(r));
  const medianOf = (list: typeof words) => showRank(median(list.map((w) => rankOf(w.es)).filter((r): r is number => r !== undefined)));
  const levels = [...new Set(placeWords.map((w) => w.level))].sort((a, b) => a - b);
  const top1000 = cov.ranked.slice(0, 1000);
  const byChapter = CHAPTERS.map((_, i) => {
    const ch = i + 1;
    const ws = words.filter((w) => chapterOf(w) <= ch);
    const ls = lessons.filter((l) => (chapterOfDistrict(l.district)?.id ?? 99) <= ch);
    const c = coverage(freq, {
      words: new Set(ws.flatMap((w) => [w.es, ...(w.alt ?? [])].flatMap(lem))),
      grammar: grammarLemmas(ls, lem),
      anywhere: anywhereLemmas(ws, ls, lem),
    });
    return top1000.filter((e) => c.covered(e.lemma)).length;
  });
  // Частые слова, которые игрок встречает поздно: из первой тысячи, но к концу главы II их нет.
  const byEndII = (() => {
    const ws = words.filter((w) => chapterOf(w) <= 2);
    const ls = lessons.filter((l) => (chapterOfDistrict(l.district)?.id ?? 99) <= 2);
    return coverage(freq, { words: new Set(ws.flatMap((w) => [w.es, ...(w.alt ?? [])].flatMap(lem))), grammar: grammarLemmas(ls, lem), anywhere: anywhereLemmas(ws, ls, lem) });
  })();
  const lateFrequent = words
    .filter((w) => chapterOf(w) > 2)
    .map((w) => ({ w, r: rankOf(w.es) }))
    .filter((x): x is { w: (typeof words)[number]; r: number } => x.r !== undefined && x.r <= 1000 && !byEndII.covered(lemmasIn(x.w.es, forms, lang).at(-1) ?? ''))
    .sort((a, b) => a.r - b.r);
  const rareEarly = placeWords
    .filter((w) => w.level <= 4 && !w.topical)
    .map((w) => ({ w, r: rankOf(w.es) }))
    .filter((x): x is { w: (typeof words)[number]; r: number } => x.r !== undefined && x.r > RARE_RANK)
    .sort((a, b) => a.w.place.localeCompare(b.w.place) || a.w.level - b.w.level);

  const s1 = share(cov, 1000);
  const s3 = share(cov, 3000);
  const s5 = share(cov, 5000);

  const out: string[] = [];
  const log = (s = '') => out.push(s);
  log(`Слов в курсе: ${words.length} из плана ${PLAN_TOTAL} (цель ${VOCAB_GOAL}), уникальных лемм среди слов мест и свитков: ${wordSet.size}, выражений: ${expressions.length}.`);
  log(
    `По главам: ${CHAPTERS.map((c) => {
      const n = placeWords.filter((w) => chapterOfLevel(w.level) === c).length;
      return `${c.chapter} ${n}/${c.places}`;
    }).join(', ')}. Свитки: ${CHAPTERS.map((c, i) => {
      const n = scrolls.find((f) => f.chapter === i + 1)?.words.length ?? 0;
      return `${c.chapter} ${n}/${c.scroll}`;
    }).join(', ')}.`,
  );
  log(`По уровням мест: ${count((w) => w.level, placeWords).map(([k, v]) => `${k}: ${v}`).join(', ')}.`);
  log(`По CEFR: ${count((w) => w.cefr).map(([k, v]) => `${k}: ${v}`).join(', ')}.`);
  log(`Медиана ранга по уровням мест: ${levels.map((l) => `${l}: ${medianOf(placeWords.filter((w) => w.level === l))}`).join(', ')}.`);
  log(`Медиана ранга свитков: ${CHAPTERS.map((c, i) => `${c.chapter}: ${medianOf(scrollWords.filter((w) => w.place === `scroll${i + 1}`))}`).join(', ')}.`);
  log(`Первая тысяча к концу главы: ${CHAPTERS.map((c, i) => `${c.chapter} ${pct(byChapter[i], top1000.length)}`).join(', ')}.`);
  log(`Частых слов (первая тысяча) позже главы II: ${lateFrequent.length}. Редких слов (дальше ${RARE_RANK}) на уровнях 1–4 без пометки topical: ${rareEarly.length}.`);
  log(`Повторы лемм между словами мест и свитков: ${repeats.length}.`);
  for (const [l, v] of repeats) log(`  ${l}: ${v.join('; ')}`);
  log();
  log(`Покрытие частотного списка (шум выброшен: ${cov.noise} лемм):`);
  for (const [s, goal] of [[s1, COVERAGE_GOAL.top1000], [s3, COVERAGE_GOAL.top3000], [s5, 0]] as const) {
    log(
      `  первые ${s.n}: ${s.total} (${pct(s.total, s.n)}), из них словами мест ${s.words}, грамматикой ${s.total - s.words}` +
        (goal ? `; цель к концу пути ${goal * 100}%` : ''),
    );
  }

  // Список недостающих слов для контентных задач.
  const md: string[] = [
    `# Частотные слова, которых нет в курсе (${lang === 'es' ? 'испанский' : 'итальянский'})`,
    '',
    'Файл собирается командой `npm run vocab`, вручную его не правят: взятые в курс слова пропадают из списка при следующей сборке.',
    'Частоты: FrequencyWords (субтитры OpenSubtitles 2018, CC BY-SA 4.0), леммы: lemmatization-lists (ODbL). Как считается покрытие, описано в `scripts/vocab-lib.ts`. Ошибки лемматизации, имена и слова жанра субтитров убраны из списка по `scripts/data/skip-<язык>.txt`.',
    '',
    `Сейчас в курсе ${words.length} слов. Покрыто: из первых 1000 — ${s1.total} (${pct(s1.total, s1.n)}), из первых 3000 — ${s3.total} (${pct(s3.total, s3.n)}), из первых 5000 — ${s5.total} (${pct(s5.total, s5.n)}).`,
    '',
    'Слова стоят в порядке частоты, число — ранг. Полоса частоты подсказывает главу, в которую слово стоит взять; место или свиток выбирается в контентной задаче. Частотный список собран по субтитрам, поэтому в нём попадаются разговорные слова, имена собственные и ошибки лемматизации: такие слова просто пропускаем.',
  ];
  md.push(
    '',
    `## Частые слова позже главы II: ${lateFrequent.length}`,
    '',
    'Из первой тысячи, но к концу главы II игрок их не встречает. Кандидаты на уровни 1–4 своего места (задача 12.1). В скобках — место и уровень (свиток — глава).',
    '',
    lateFrequent.map(({ w, r }) => `${w.es} ${r} (${w.place.startsWith('scroll') ? w.place : `${w.place} ${w.level}`})`).join(' · ') || '—',
    '',
    `## Редкие слова на уровнях 1–4: ${rareEarly.length}`,
    '',
    `Лемма дальше ${RARE_RANK} в частотном списке или вне его. Либо слово уходит на уровни 5–6, либо оно нужно месту и помечается \`topical: true\` (не больше трёх на урок).`,
    '',
    rareEarly.map(({ w, r }) => `${w.es} ${showRank(r)} (${w.place} ${w.level})`).join(' · ') || '—',
  );
  for (const b of BANDS) {
    const missing = cov.ranked.slice(b.from - 1, b.to).filter((e) => !cov.covered(e.lemma));
    md.push('', `## ${b.from}–${b.to}: глава ${b.chapters}, нет в курсе ${missing.length}`, '');
    md.push(missing.map((e) => `${e.lemma} ${e.rank}`).join(' · '));
  }
  mkdirSync(join(root, 'docs', 'vocab'), { recursive: true });
  writeFileSync(join(root, 'docs', 'vocab', `${lang}.md`), md.join('\n') + '\n');
  return out.join('\n');
}

const langs = readdirSync(content, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(content, e.name, 'words')))
  .map((e) => e.name);
for (const lang of langs) {
  console.log(`\n== ${lang} ==`);
  console.log(report(lang));
}
console.log('\nСписки недостающих слов: docs/vocab/<язык>.md');
