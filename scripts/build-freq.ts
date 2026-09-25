/**
 * Строит частотный список лемм для сверки словаря (задача 0.4 в docs/ROADMAP.md).
 *
 *   npx tsx scripts/build-freq.ts <язык> <частоты.txt> <лемматизация.txt>
 *
 * Источники (скачиваются вручную, в репозиторий не кладутся):
 * - частоты словоформ по субтитрам OpenSubtitles 2018: github.com/hermitdave/FrequencyWords,
 *   content/2018/<язык>/<язык>_50k.txt, лицензия CC BY-SA 4.0;
 * - лемматизация «лемма<TAB>форма»: github.com/michmech/lemmatization-lists,
 *   lemmatization-<язык>.txt, лицензия ODbL.
 *
 * Результат:
 * - scripts/data/freq-<язык>.tsv: ранг, лемма, частота, признак «нет в словаре лемм» (служебные
 *   слова, имена, английские вставки: отчёт учитывает такие леммы, только если они есть в курсе);
 * - scripts/data/lemmas-<язык>.tsv: форма → лемма для частых форм, чтобы приводить слова курса к леммам.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [lang, freqPath, lemPath] = process.argv.slice(2);
if (!lang || !freqPath || !lemPath) {
  console.error('Использование: npx tsx scripts/build-freq.ts <язык> <частоты.txt> <лемматизация.txt>');
  process.exit(1);
}

const KEEP = 7000;
const WORD = /^[a-záéíóúüñàèìòùç']+$/;
// Ругательства часты в субтитрах, но в курс их не берём.
const SKIP: Record<string, string[]> = {
  es: ['joder', 'mierda', 'puta', 'puto', 'coño', 'cabrón', 'carajo', 'gilipollas', 'pendejo', 'culo', 'follar', 'chingar'],
  it: ['cazzo', 'merda', 'fottere', 'stronzo', 'puttana', 'fanculo', 'cazzata', 'culo', 'coglione', 'troia', 'scopare', 'bastardo'],
};

// Ручные леммы для самых частых неоднозначных форм: «para» — предлог, а не форма parar,
// артикли и слитные предлоги сводятся к одному слову. Такие леммы помечаются как служебные.
const OVERRIDE: Record<string, Record<string, string>> = {
  es: {
    para: 'para', como: 'como', cómo: 'cómo', la: 'el', los: 'el', las: 'el', del: 'de', al: 'a',
    un: 'uno', una: 'uno', unos: 'uno', unas: 'uno', sobre: 'sobre', entre: 'entre', bajo: 'bajo',
    era: 'ser', son: 'ser', sólo: 'solo', arriba: 'arriba', vete: 'ir',
  },
  it: {
    la: 'il', lo: 'il', le: 'il', "l'": 'il', "un'": 'uno', "c'": 'ci', po: 'poco', "po'": 'poco',
    era: 'essere', piu: 'più', perche: 'perché', cosi: 'così', e: 'e', ad: 'a', ed: 'e', i: 'il', gli: 'il', un: 'uno', una: 'uno',
    del: 'di', dello: 'di', della: 'di', dei: 'di', degli: 'di', delle: 'di',
    al: 'a', allo: 'a', alla: 'a', ai: 'a', agli: 'a', alle: 'a',
    dal: 'da', dallo: 'da', dalla: 'da', dai: 'da', dagli: 'da', dalle: 'da',
    nel: 'in', nello: 'in', nella: 'in', nei: 'in', negli: 'in', nelle: 'in',
    sul: 'su', sullo: 'su', sulla: 'su', sui: 'su', sugli: 'su', sulle: 'su',
    "dell'": 'di', "all'": 'a', "dall'": 'da', "nell'": 'in', "sull'": 'su', col: 'con',
    uno: 'uno', meno: 'meno', nulla: 'nulla', visto: 'vedere', visti: 'vedere', vista: 'vista',
    come: 'come', ancora: 'ancora', dopo: 'dopo', sopra: 'sopra',
  },
};

const NUMBERS: Record<string, string[]> = {
  es: ['dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'quince', 'veinte', 'treinta', 'cien', 'ciento', 'mil'],
  it: ['due', 'tre', 'quattro', 'cinque', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'quindici', 'venti', 'trenta', 'cento', 'mille'],
};

const lines = (p: string) => readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);

// Лемматизация: форма → леммы; множество лемм (словарные формы).
const lemmasOf = new Map<string, Set<string>>();
const headwords = new Set<string>();
for (const line of lines(lemPath)) {
  const [lemma, form] = line.toLowerCase().split('\t');
  if (!lemma || !form) continue;
  headwords.add(lemma);
  if (!lemmasOf.has(form)) lemmasOf.set(form, new Set());
  lemmasOf.get(form)!.add(lemma);
}

const formCount = new Map<string, number>();
for (const line of lines(freqPath)) {
  const [w, c] = line.split(' ');
  if (WORD.test(w)) formCount.set(w, Number(c));
}

// Первый проход: частоты лемм, если словарная форма всегда остаётся собой. Нужны, чтобы решить,
// чем чаще бывает форма вроде «pasa»: отдельным словом или формой глагола.
const naiveTotal = new Map<string, number>();
for (const [form, count] of formCount) {
  const l = headwords.has(form) ? form : [...(lemmasOf.get(form) ?? [form])][0];
  naiveTotal.set(l, (naiveTotal.get(l) ?? 0) + count);
}

/**
 * Лемма формы. Форма, которая сама словарное слово, остаётся собой: иначе «para» стало бы глаголом parar,
 * а «nada» — nadar. Из нескольких лемм выбирается самая частая как словоформа.
 */
function lemmaOf(form: string): { lemma: string; known: boolean } {
  const o = OVERRIDE[lang]?.[form];
  if (o) return { lemma: o, known: false };
  // Наречия на -mente и числительные — обычные слова, хоть их и нет в словаре лемм.
  if (form.endsWith('mente') || NUMBERS[lang]?.includes(form)) return { lemma: form, known: true };
  return dictLemma(form) ?? cliticLemma(form) ?? { lemma: form, known: false };
}

/** Правильное причастие глагола: pasar → pasado, finire → finito. */
function isParticiple(form: string, verb: string): boolean {
  const m = verb.match(/^(.+)(ar|er|ir|are|ere|ire)$/);
  if (!m) return false;
  const ends: Record<string, string[]> = { ar: ['ado'], er: ['ido'], ir: ['ido'], are: ['ato'], ere: ['uto'], ire: ['ito'] };
  return ends[m[2]].some((e) => form === m[1] + e);
}

function dictLemma(form: string): { lemma: string; known: boolean } | null {
  const others = [...(lemmasOf.get(form) ?? [])].filter((l) => l !== form);
  const byCount = (a: string, b: string) => (formCount.get(b) ?? 0) - (formCount.get(a) ?? 0);
  if (!headwords.has(form)) return others.length ? { lemma: others.sort(byCount)[0], known: true } : null;
  const n = formCount.get(form) ?? 0;
  // Форма сама словарное слово, но может быть и формой другого: «nueva» — это nuevo, «pasa» — pasar
  // (изюм встречается редко), «pasado» — pasar. Другое слово берётся, если оно заметно частотнее.
  const selfRest = (naiveTotal.get(form) ?? 0) - n;
  for (const o of others.sort(byCount)) {
    const total = naiveTotal.get(o) ?? 0;
    if (total > n && selfRest < n / 10) return { lemma: o, known: true };
    if (isParticiple(form, o) && total > n / 2) return { lemma: o, known: true };
  }
  return { lemma: form, known: true };
}

// Местоимения, которые пишутся слитно с глаголом: «escúchame», «irse», «chiamarlo», «dacci».
const CLITICS: Record<string, string[]> = {
  es: ['selo', 'sela', 'selos', 'selas', 'melo', 'mela', 'telo', 'tela', 'noslo', 'me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'los', 'las', 'le', 'les'],
  it: ['glielo', 'gliela', 'glieli', 'gliele', 'melo', 'tela', 'telo', 'mi', 'ti', 'si', 'ci', 'vi', 'lo', 'la', 'li', 'le', 'ne', 'gli'],
};
const unaccent = (s: string) => s.replace(/[áéíóú]/g, (c) => 'aeiou'['áéíóú'.indexOf(c)]);

const isVerb = (l: string) => /(r|re|rsi|rse)$/.test(l);

function cliticLemma(form: string): { lemma: string; known: boolean } | null {
  for (const c of [...(CLITICS[lang] ?? [])].sort((a, b) => b.length - a.length)) {
    if (!form.endsWith(c) || form.length - c.length < 2) continue;
    const stem = form.slice(0, -c.length);
    // es: «escúcha-me» → escucha → escuchar; it: «far-la» → fare, «dac-ci» → da → dare.
    for (const base of lang === 'it' ? [stem + 'e', stem, stem.replace(/(.)\1$/, '$1')] : [unaccent(stem), stem]) {
      const cands = [...(headwords.has(base) ? [base] : []), ...(lemmasOf.get(base) ?? [])].filter(isVerb);
      if (cands.length) return { lemma: cands.sort((a, b) => (formCount.get(b) ?? 0) - (formCount.get(a) ?? 0))[0], known: true };
    }
  }
  return null;
}

const lemmaCount = new Map<string, { count: number; known: boolean }>();
const formToLemma = new Map<string, string>();
for (const [form, count] of formCount) {
  const { lemma, known } = lemmaOf(form);
  if (SKIP[lang]?.includes(lemma)) continue;
  const e = lemmaCount.get(lemma) ?? { count: 0, known };
  e.count += count;
  lemmaCount.set(lemma, e);
  if (lemma !== form) formToLemma.set(form, lemma);
}

const top = [...lemmaCount].sort((a, b) => b[1].count - a[1].count).slice(0, KEEP);
const topSet = new Set(top.map(([l]) => l));
const header = [
  `# Частотный список лемм (${lang}), ${KEEP} самых частых. Построен scripts/build-freq.ts.`,
  '# Частоты: FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0. Лемматизация: lemmatization-lists, ODbL.',
  '# Колонки: ранг, лемма, частота, ? — леммы нет в словаре лемм (служебное слово, имя или иностранное).',
];
writeFileSync(
  join('scripts', 'data', `freq-${lang}.tsv`),
  [...header, ...top.map(([l, e], i) => `${i + 1}\t${l}\t${Math.round(e.count)}\t${e.known ? '' : '?'}`)].join('\n') + '\n',
);
const pairs = [...formToLemma].filter(([, l]) => topSet.has(l)).sort(([a], [b]) => a.localeCompare(b));
writeFileSync(
  join('scripts', 'data', `lemmas-${lang}.tsv`),
  [
    `# Форма → лемма (${lang}) для частых форм. Построен scripts/build-freq.ts из lemmatization-lists (ODbL).`,
    ...pairs.map(([f, l]) => `${f}\t${l}`),
  ].join('\n') + '\n',
);
console.log(`${lang}: ${top.length} лемм, ${pairs.length} форм`);
