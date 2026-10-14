/**
 * Частотный список лемм турецкого (задача 18.1). У турецкого нет таблицы «лемма — форма» в lemmatization-lists,
 * а словоформ у слова сотни, поэтому лемма формы ищется разбором аффиксов (`analyze` из `src/langs/tr/morph.ts`)
 * по словарю лемм Zemberek.
 *
 *   npx tsx scripts/build-freq-tr.ts <tr_50k.txt> <master-dictionary.dict> [non-tdk.dict …]
 *
 * Источники (скачиваются вручную, в репозиторий не кладутся):
 * - частоты словоформ по субтитрам OpenSubtitles 2018: github.com/hermitdave/FrequencyWords,
 *   content/2018/tr/tr_50k.txt, лицензия CC BY-SA 4.0;
 * - словарь лемм с частями речи: github.com/ahmetaa/zemberek-nlp, morphology/src/main/resources/tr/
 *   master-dictionary.dict и non-tdk.dict, лицензия Apache 2.0.
 *
 * Результат — те же файлы, что у других языков: scripts/data/freq-tr.tsv и scripts/data/lemmas-tr.tsv.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeDepth, infinitive } from '../src/langs/tr/morph';

const [freqPath, ...dictPaths] = process.argv.slice(2);
if (!freqPath || !dictPaths.length) {
  console.error('Использование: npx tsx scripts/build-freq-tr.ts <tr_50k.txt> <master-dictionary.dict> [non-tdk.dict …]');
  process.exit(1);
}

const KEEP = 7000;
const lower = (s: string) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
const WORD = /^[a-zçğıöşüâîû]+$/;
// Ругательства часты в субтитрах, но в курс их не берём.
const SKIP = ['siktir', 'sikmek', 'amk', 'lan', 'orospu', 'piç', 'göt', 'kahpe', 'yavşak', 'amcık', 'şerefsiz', 'pezevenk'];
// Местоимения с неправильными или однобуквенными основами: bana, sana — от ben, sen; onu, ona — от o.
const OVERRIDE: Record<string, string> = {
  bana: 'ben', beni: 'ben', bende: 'ben', benden: 'ben', benim: 'ben', benimle: 'ben',
  sana: 'sen', seni: 'sen', sende: 'sen', senden: 'sen', senin: 'sen', seninle: 'sen',
  onu: 'o', ona: 'o', onda: 'o', ondan: 'o', onun: 'o', onunla: 'o', onlar: 'o', onları: 'o', onlara: 'o',
  onların: 'o', onlarla: 'o', onlardan: 'o',
  bize: 'biz', bizi: 'biz', bizim: 'biz', bizden: 'biz', bizimle: 'biz', size: 'siz', sizi: 'siz', sizin: 'siz',
  sizden: 'siz', sizinle: 'siz',
  bunu: 'bu', buna: 'bu', bunun: 'bu', bunda: 'bu', bundan: 'bu', bunlar: 'bu', bunları: 'bu', bunlara: 'bu',
  şunu: 'şu', şuna: 'şu', şunun: 'şu', şunlar: 'şu',
};

const lines = (p: string) => readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);

// Словарь: имена (существительные, прилагательные, наречия, служебные) и глаголы — инфинитивом на -mek/-mak
// без пометки части речи (hamak [P:Noun] — гамак, не глагол).
const names = new Set<string>();
const verbs = new Set<string>();
const dropping = new Set<string>();
const doubling = new Set<string>();
function addLemma(lemma: string, line: string) {
  const pos = line.match(/P:(\w+)/)?.[1];
  if (/m[ea]k$/.test(lemma) && (!pos || pos === 'Verb')) verbs.add(lemma);
  else names.add(lemma);
  if (line.includes('LastVowelDrop')) dropping.add(lemma);
  if (line.includes('Doubling')) doubling.add(lemma);
}
for (const p of dictPaths) {
  for (const line of lines(p)) {
    const raw = lower(line.split('[')[0].trim());
    if (!raw || !WORD.test(raw)) continue;
    // Старое написание с циркумфлексом (silâh, evlât): в курсе и в субтитрах — без него.
    for (const lemma of new Set([raw, raw.replace(/[âîû]/g, (c) => ({ â: 'a', î: 'i', û: 'u' })[c]!)])) addLemma(lemma, line);
  }
}
/** Есть ли лемма в словаре: глагол и имя раздельно, основа с вернувшейся гласной или без удвоения — по пометке. */
const known = (l: string, verb?: boolean, how: 'plain' | 'drop' | 'double' = 'plain') => {
  if (how === 'drop' && !dropping.has(l)) return false;
  if (how === 'double' && !doubling.has(l)) return false;
  return verb === undefined ? names.has(l) || verbs.has(l) : verb ? verbs.has(l) : names.has(l);
};
const lexicon = new Set([...names, ...verbs]);

const formCount = new Map<string, number>();
for (const line of lines(freqPath)) {
  const [w, c] = line.split(' ');
  const form = lower(w ?? '');
  if (WORD.test(form)) formCount.set(form, (formCount.get(form) ?? 0) + Number(c));
}

// Кандидаты каждой формы — разборы с наименьшим числом снятых аффиксов («karanlıkta» — karanlık, а не
// kar-an-lık-ta) — и их поддержка: сколько употреблений в корпусе может к ним сводиться (доля формы делится
// поровну между кандидатами). Из равных по разбору побеждает лемма с большей поддержкой: «aldım» — almak
// (alıyorum, alacak, almadım), а не al «красный».
const candidates = new Map<string, string[]>();
const support = new Map<string, number>();
for (const [form, count] of formCount) {
  if (OVERRIDE[form] || known(form)) continue;
  const all = [...analyzeDepth(form, known)].filter(([l]) => l !== form);
  const min = Math.min(...all.map(([, d]) => d));
  const cands = all.filter(([, d]) => d === min).map(([l]) => l);
  candidates.set(form, cands);
  for (const l of cands) support.set(l, (support.get(l) ?? 0) + count / cands.length);
}
for (const l of lexicon) if (formCount.has(l)) support.set(l, (support.get(l) ?? 0) + formCount.get(l)!);

/** Лемма формы: сама форма, если она есть в словаре, иначе кандидат с наибольшей поддержкой. */
function lemmaOf(form: string): { lemma: string; known: boolean } {
  const o = OVERRIDE[form];
  if (o) return { lemma: o, known: true };
  // Основа глагола, которая сама есть словом (al «красный», et «мясо»): повелительное al чаще, чем прилагательное,
  // если у глагола поддержка больше.
  const inf = infinitive(form);
  if (known(form) && known(inf, true) && (support.get(inf) ?? 0) > (support.get(form) ?? 0)) return { lemma: inf, known: true };
  if (known(form)) return { lemma: form, known: true };
  const cands = candidates.get(form) ?? [];
  if (!cands.length) return { lemma: form, known: false };
  const best = [...cands].sort((a, b) => (support.get(b) ?? 0) - (support.get(a) ?? 0) || b.length - a.length)[0];
  return { lemma: best, known: true };
}

const lemmaCount = new Map<string, { count: number; known: boolean }>();
const formToLemma = new Map<string, string>();
for (const [form, count] of formCount) {
  const { lemma, known: k } = lemmaOf(form);
  if (SKIP.includes(lemma) || SKIP.includes(form)) continue;
  const e = lemmaCount.get(lemma) ?? { count: 0, known: k };
  e.count += count;
  lemmaCount.set(lemma, e);
  if (lemma !== form) formToLemma.set(form, lemma);
}

const top = [...lemmaCount].sort((a, b) => b[1].count - a[1].count).slice(0, KEEP);
const topSet = new Set(top.map(([l]) => l));
writeFileSync(
  join('scripts', 'data', 'freq-tr.tsv'),
  [
    `# Частотный список лемм (tr), ${KEEP} самых частых. Построен scripts/build-freq-tr.ts.`,
    '# Частоты: FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0. Леммы: словарь Zemberek (Apache 2.0) и разбор аффиксов.',
    '# Колонки: ранг, лемма, частота, ? — леммы нет в словаре (имя, иностранное слово, неразобранная форма).',
    ...top.map(([l, e], i) => `${i + 1}\t${l}\t${Math.round(e.count)}\t${e.known ? '' : '?'}`),
  ].join('\n') + '\n',
);
const pairs = [...formToLemma].filter(([, l]) => topSet.has(l)).sort(([a], [b]) => a.localeCompare(b, 'tr'));
writeFileSync(
  join('scripts', 'data', 'lemmas-tr.tsv'),
  [
    '# Форма → лемма (tr) для частых форм. Построен scripts/build-freq-tr.ts разбором аффиксов по словарю Zemberek (Apache 2.0).',
    ...pairs.map(([f, l]) => `${f}\t${l}`),
  ].join('\n') + '\n',
);
console.log(`tr: ${top.length} лемм, ${pairs.length} форм, без леммы ${top.filter(([, e]) => !e.known).length}`);
