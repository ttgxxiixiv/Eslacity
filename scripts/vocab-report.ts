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
import { anywhereLemmas, BANDS, coverage, grammarLemmas, lemmasIn, parseFreq, parseLemmas, share } from './vocab-lib';

const root = join(import.meta.dirname, '..');
const content = join(root, 'src', 'content');
const read = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
const pct = (a: number, b: number) => `${Math.round((a / b) * 1000) / 10}%`;

function report(lang: string): string {
  const freq = parseFreq(readFileSync(join(root, 'scripts', 'data', `freq-${lang}.tsv`), 'utf8'));
  const forms = parseLemmas(readFileSync(join(root, 'scripts', 'data', `lemmas-${lang}.tsv`), 'utf8'));
  const lem = (s: string) => lemmasIn(s, forms, lang);

  const files = readdirSync(join(content, lang, 'words'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => read<LocationWords>(join(content, lang, 'words', f)));
  const placeWords = files.flatMap((f) => f.words.map((w) => ({ ...w, place: f.location as string })));
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
  const anywhere = anywhereLemmas(words, lessons, lem);
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
  const s1 = share(cov, 1000);
  const s3 = share(cov, 3000);
  const s5 = share(cov, 5000);

  const out: string[] = [];
  const log = (s = '') => out.push(s);
  log(`Слов в курсе: ${words.length} из плана ${PLAN_TOTAL} (цель ${VOCAB_GOAL}), уникальных лемм среди слов мест и свитков: ${wordSet.size}.`);
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
    'Частоты: FrequencyWords (субтитры OpenSubtitles 2018, CC BY-SA 4.0), леммы: lemmatization-lists (ODbL). Как считается покрытие, описано в `scripts/vocab-lib.ts`.',
    '',
    `Сейчас в курсе ${words.length} слов. Покрыто: из первых 1000 — ${s1.total} (${pct(s1.total, s1.n)}), из первых 3000 — ${s3.total} (${pct(s3.total, s3.n)}), из первых 5000 — ${s5.total} (${pct(s5.total, s5.n)}).`,
    '',
    'Слова стоят в порядке частоты, число — ранг. Полоса частоты подсказывает главу, в которую слово стоит взять; место или свиток выбирается в контентной задаче. Частотный список собран по субтитрам, поэтому в нём попадаются разговорные слова, имена собственные и ошибки лемматизации: такие слова просто пропускаем.',
  ];
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
