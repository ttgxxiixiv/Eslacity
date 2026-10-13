import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateChronicler, validateGrammar, validateGuardians, validateLetters, validateNotes, validateMissions, validateNpcs, validatePhrases, validateScenes, validatePortraits, validateScrolls, validateSphinx, validateTranslations, validateVerbs, validatePairs, validateFestivals, validatePrologue, validateThread, validateBooks, validateRumors, validateDiary, validateStory, STORY_FORKS, validateWords, type Issue } from '../src/content/validate';
import type { Chronicler, GrammarLesson, GuardiansFile, LettersFile, SphinxFile, VerbsFile, PairsFile, FestivalFile, PrologueFile, RumorsFile, DiaryFile, Scene, LocationWords, LocationMissions, LocationPhrases, LocationScenes, NpcsFile, ScrollFile, ThreadFile, BookFile } from '../src/content/schema';
import { THREAD_CHAPTERS, THREAD_NOTES_MIN } from '../src/domain/thread';
import { BOOK_CHAPTERS } from '../src/domain/books';
import { LANGS, type Lang } from '../src/lang';
import { CHAPTERS, PLAN_TOTAL } from '../src/content/vocabPlan';
import { chapterOfDistrict } from '../src/domain/chapters';
import { plural } from '../src/domain/medals';
import { femIssues, forGender } from '../src/domain/address';
import { textIssuesIn, translationIssues } from '../src/domain/translation';
import { sayIssues } from '../src/domain/say';
import { lessonParts, levelWords } from '../src/domain/levels';
import { applySkips, applySkipsToForms, buildLexicon, cefrIssues, coverage, lemmaRanks, parseRisky, rarityIssues, riskyIssues, wordRank, lemmasIn, parseFreq, parseSkips, parseLemmas, textCoverage, uncoveredWords } from './vocab-lib';

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

function sceneSummary(r: { scenes: number; whispers: number; words: number; unknown: number }): string {
  const share = r.words ? Math.round((r.unknown / r.words) * 1000) / 10 : 0;
  const talks = r.scenes - r.whispers;
  return `${talks} ${plural(talks, ['сцена', 'сцены', 'сцен'])} и ${r.whispers} ${plural(r.whispers, ['шёпот', 'шёпота', 'шёпотов'])} (незнакомых слов ${share}%)`;
}
const summary: string[] = [];
const langs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name in LANGS)
  .map((e) => e.name as Lang);

const contentFiles = (dir: string, rel = ''): string[] =>
  readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? contentFiles(full, `${rel}${f}/`) : f.endsWith('.json') ? [`${rel}${f}`] : [];
  });

/**
 * Правила перевода (задача 15.3), поле say (15.4) и ошибки текста языка (английские a/an, 17.1) — по всем файлам
 * контента языка. Предупреждения, кроме ошибок текста.
 */
function textChecks(lang: Lang): Issue[] {
  return contentFiles(join(root, lang)).flatMap((rel) => {
    const data = JSON.parse(readFileSync(join(root, lang, rel), 'utf8'));
    return [
      ...[...translationIssues(data, lang), ...sayIssues(data)].map(({ where, msg }) => ({ level: 'warning' as const, where: `${lang}/${rel} ${where}`, msg })),
      ...textIssuesIn(data, lang).map(({ where, msg }) => ({ level: 'error' as const, where: `${lang}/${rel} ${where}`, msg })),
    ];
  });
}

const readFile = <T,>(lang: Lang, name: string): T | undefined =>
  existsSync(join(root, lang, name)) ? (JSON.parse(readFileSync(join(root, lang, name), 'utf8')) as T) : undefined;

/** Частотные данные языка и словарь курса: слова мест, свитков и уроков по уровням. */
function langLexicon(lang: Lang, words: { data: LocationWords }[], scrolls: { data: ScrollFile }[], lessons: GrammarLesson[]) {
  const dataDir = join(root, '..', '..', 'scripts', 'data');
  const skips = parseSkips(readFileSync(join(dataDir, `skip-${lang}.txt`), 'utf8'));
  const forms = applySkipsToForms(parseLemmas(readFileSync(join(dataDir, `lemmas-${lang}.tsv`), 'utf8')), skips);
  const freq = applySkips(parseFreq(readFileSync(join(dataDir, `freq-${lang}.tsv`), 'utf8')), skips);
  const lexicon = buildLexicon(
    [
      ...words.flatMap((f) => f.data.words),
      ...scrolls.flatMap((f) => f.data.words.map((w) => ({ ...w, level: CHAPTERS[f.data.chapter - 1]?.levels[0] ?? 99 }))),
    ],
    lessons,
    freq,
    (t) => lemmasIn(t, forms, lang),
  );
  return { dataDir, forms, freq, lexicon };
}

/**
 * Фразы, сцены и миссии закрытого курса (английский с 17.5): те же проверки, что у открытого, и они же в роде путницы.
 * Развилок не меньше двух требуют главы, у которых уже есть миссии следующей главы: последствия пишутся в ней.
 */
function partialStoryChecks(
  lang: Lang,
  npcs: NpcsFile | undefined,
  words: { data: LocationWords }[],
  scrolls: { data: ScrollFile }[],
  lessons: GrammarLesson[],
): Issue[] {
  const phrases = readJson<LocationPhrases>(join(root, lang, 'phrases'));
  const sceneFiles = readJson<LocationScenes>(join(root, lang, 'scenes'));
  const scenes = sceneFiles.filter((f) => f.name !== 'thread.json');
  const threadFile = sceneFiles.find((f) => f.name === 'thread.json') as { name: string; data: ThreadFile } | undefined;
  const missions = readJson<LocationMissions>(join(root, lang, 'missions'));
  if (!phrases.length && !scenes.length && !missions.length) return [];
  const { forms, lexicon } = langLexicon(lang, words, scrolls, lessons);
  const coverage = (text: string, level: number) => textCoverage(text, level, lexicon, forms, lang);
  const residents = Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id]));
  const lessonIds = new Set(lessons.map((g) => g.id));
  const check = (ph: typeof phrases, sc: typeof scenes, ms: typeof missions) => [
    ...validatePhrases(ph, { lessons: lessonIds, uncovered: (text, level) => uncoveredWords(text, level, lexicon, forms, lang) }),
    ...validateScenes(sc, { residents, pitch: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.id, n.voice.pitch])), coverage }).issues,
    ...validateMissions(ms, {
      residents,
      registers: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.register])),
      phrases: Object.fromEntries(ph.map((f) => [f.data.location, f.data.phrases])),
      scenes: new Set(scenes.flatMap((f) => f.data.scenes.map((s) => s.id))),
      coverage,
    }),
  ];
  const fem = <T,>(list: { name: string; data: T }[]) => list.map((f) => ({ name: f.name, data: forGender(f.data, 'f') }));
  const chapters = new Set(missions.flatMap((f) => f.data.missions.map((m) => m.chapter)));
  const forks = { chapters: STORY_FORKS.chapters.filter((c) => chapters.has(c + 1)), min: STORY_FORKS.min };
  const femFiles = [...scenes.map((f) => ['scenes', f] as const), ...missions.map((f) => ['missions', f] as const), ...phrases.map((f) => ['phrases', f] as const)];
  return [
    ...check(phrases, scenes, missions),
    ...check(fem(phrases), fem(scenes), fem(missions))
      .filter((i) => !i.msg.includes('из gloss нет в репликах'))
      .map((i) => ({ ...i, where: `${i.where} (путница)` })),
    ...femFiles.flatMap(([dir, f]) => femIssues(f.data, `${dir}/${f.name}`).map((msg) => ({ level: 'error' as const, where: `${dir}/${f.name}`, msg }))),
    ...validateStory(scenes, missions, threadFile, forks),
    ...threadChecks(lang, threadFile, npcs, coverage),
    ...prologueChecks(lang, words, scrolls, (text) => uncoveredWords(text, 1, lexicon, forms, lang)),
    ...bookChecks(lang, coverage),
    ...rumorDiaryChecks(lang, npcs, [...scenes.flatMap((f) => f.data.scenes ?? []), ...(threadFile?.data.scenes ?? [])], coverage),
    ...letterChecks(readFile<LettersFile>(lang, 'letters.json'), residents, coverage),
    ...sphinxChecks(lang, npcs, coverage),
  ];
}

/** Нить глав закрытого курса (английский с 17.9): сцены Летописца и записки, если файл уже есть, и они же в роде путницы. */
function threadChecks(
  lang: Lang,
  threadFile: { name: string; data: ThreadFile } | undefined,
  npcs: NpcsFile | undefined,
  coverage: (text: string, level: number) => ReturnType<typeof textCoverage>,
): Issue[] {
  if (!threadFile) return [];
  const checks = {
    chronicler: readFile<Chronicler>(lang, 'chronicler.json')?.id ?? '',
    residents: (npcs?.npcs ?? []).map((n) => n.id),
    chapters: THREAD_CHAPTERS,
    notesMin: THREAD_NOTES_MIN,
    coverage,
  };
  const where = `scenes/${threadFile.name}`;
  return [
    ...validateThread(threadFile, checks).issues,
    ...validateThread({ name: threadFile.name, data: forGender(threadFile.data, 'f') }, checks)
      .issues.filter((i) => !i.msg.includes('из gloss нет в репликах'))
      .map((i) => ({ ...i, where: `${i.where} (путница)` })),
    ...femIssues(threadFile.data, where).map((msg) => ({ level: 'error' as const, where, msg })),
  ];
}

/** Книги Летописца закрытого курса (английский с 17.9): у каждой уже начатой главы все четыре текста. */
function bookChecks(lang: Lang, coverage: (text: string, level: number) => ReturnType<typeof textCoverage>): Issue[] {
  const dir = join(root, lang, 'books');
  if (!existsSync(dir)) return [];
  const books = readJson<BookFile>(dir);
  return validateBooks(books, { chapters: books.map((f) => f.data.chapter), coverage, gender: LANGS[lang].gender });
}

/** Слухи и дневник путника закрытого курса (английский с 17.9): как у открытого, если файлы уже есть. */
function rumorDiaryChecks(
  lang: Lang,
  npcs: NpcsFile | undefined,
  scenes: Scene[],
  coverage: (text: string, level: number) => ReturnType<typeof textCoverage>,
): Issue[] {
  const rumors = readFile<RumorsFile>(lang, 'rumors.json');
  const diary = readFile<DiaryFile>(lang, 'diary.json');
  const chronicler = readFile<Chronicler>(lang, 'chronicler.json');
  return [
    ...(rumors ? validateRumors(rumors, new Set([...(npcs?.npcs ?? []).map((n) => n.id), ...(chronicler ? [chronicler.id] : [])]), coverage) : []),
    ...(diary ? validateDiary(diary, { scenes, rumors: rumors?.rumors ?? [] }) : []),
  ];
}

/** Пролог закрытого курса (английский с 17.9): как у открытого, если файл уже есть. */
function prologueChecks(
  lang: Lang,
  words: { data: LocationWords }[],
  scrolls: { data: ScrollFile }[],
  uncovered: (text: string) => string[],
): Issue[] {
  const prologue = readFile<PrologueFile>(lang, 'prologue.json');
  if (!prologue) return [];
  return validatePrologue(prologue, {
    words: new Map([...words.flatMap((f) => f.data.words), ...scrolls.flatMap((f) => f.data.words)].map((w) => [w.id, w])),
    uncovered,
  });
}

/** Сфинкс закрытого курса (английский с 17.8): те же проверки, что у открытого, если файл уже есть. */
function sphinxChecks(lang: Lang, npcs: NpcsFile | undefined, coverage: (text: string, level: number) => ReturnType<typeof textCoverage>): Issue[] {
  const sphinx = readFile<SphinxFile>(lang, 'sphinx.json');
  if (!sphinx) return [];
  const chronicler = readFile<Chronicler>(lang, 'chronicler.json');
  return validateSphinx(sphinx, {
    coverage,
    voices: {
      ...Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.id, n.voice.pitch])),
      ...(chronicler ? { [chronicler.id]: chronicler.voice.pitch } : {}),
    },
  });
}

/** Письма и записки закрытого курса (английский с 17.8): как у открытого, и ещё раз в роде путницы. */
function letterChecks(letters: LettersFile | undefined, residents: Record<string, string>, coverage: (text: string, level: number) => ReturnType<typeof textCoverage>): Issue[] {
  if (!letters) return [];
  const fem = forGender(letters, 'f');
  return [
    ...validateLetters(letters, residents),
    ...validateNotes(letters, residents, coverage),
    ...[...validateLetters(fem, residents), ...validateNotes(fem, residents)].map((i) => ({ ...i, where: `${i.where} (путница)` })),
  ];
}

/**
 * Слова закрытого курса (английский с 17.3): места и свитки, одинаковые переводы, редкие слова на уровнях 1–4,
 * CEFR по частотности и рискованные леммы — как у открытого курса, но без проверок, которым нужны уроки и сцены.
 */
function partialWordChecks(
  lang: Lang,
  words: { name: string; data: LocationWords }[],
  scrolls: { name: string; data: ScrollFile }[],
  lessons: GrammarLesson[],
): Issue[] {
  if (!words.length && !scrolls.length) return [];
  const { dataDir, forms, freq, lexicon } = langLexicon(lang, words, scrolls, lessons);
  const ranks = lemmaRanks(coverage(freq, { words: new Set(lexicon.wordLevel.keys()), grammar: lexicon.grammar, anywhere: lexicon.anywhere }));
  const rank = (es: string) => wordRank(es, forms, lang, ranks);
  const risky = parseRisky(readFileSync(join(dataDir, `risky-${lang}.txt`), 'utf8'));
  const sources = [
    ...words.map((f) => ({ where: `words/${f.name}`, words: f.data.words })),
    ...scrolls.map((f) => ({ where: `scrolls/${f.name}`, words: f.data.words })),
  ];
  const warn = (where: string) => ({ id, msg }: { id: string; msg: string }) => ({ level: 'warning' as const, where: `${where} ${id}`, msg });
  return [
    ...validateWords(words, lang),
    ...validateScrolls(scrolls, words, lang),
    ...validateTranslations(words, scrolls),
    ...words.flatMap((f) => {
      const plain = f.data.words.filter((w) => !w.kind);
      const levels = [...new Set(plain.map((w) => w.level))].map((level) => ({ level, words: levelWords(plain, level) }));
      return rarityIssues(levels, rank, lessonParts).map(warn(`words/${f.name}`));
    }),
    ...sources.flatMap(({ where, words: ws }) => [
      ...cefrIssues(ws, rank).map(warn(where)),
      ...riskyIssues(ws, risky, (t) => lemmasIn(t, forms, lang)).map(warn(where)),
    ]),
  ];
}

/**
 * Закрытый курс (английский с 17.2): проверяются уже готовые файлы — жители, Летописец, стражи всех пяти глав,
 * кузница, Звонница, портреты, тексты и, когда они есть, слова мест и свитков, уроки, фразы, сцены и миссии.
 */
function partialChecks(lang: Lang): void {
  const words = readJson<LocationWords>(join(root, lang, 'words'));
  const scrolls = readJson<ScrollFile>(join(root, lang, 'scrolls'));
  const grammarDir = join(root, lang, 'grammar');
  const grammar = existsSync(grammarDir)
    ? readdirSync(grammarDir).flatMap((d) => readJson<GrammarLesson>(join(grammarDir, d)).map((f) => ({ ...f, name: `${d}/${f.name}` })))
    : [];
  const tag = (list: Issue[]) => list.map((i) => ({ ...i, where: `${lang}/${i.where}` }));
  const npcs = readFile<NpcsFile>(lang, 'npcs.json');
  const chronicler = readFile<Chronicler>(lang, 'chronicler.json');
  const guardians = readFile<GuardiansFile>(lang, 'guardians.json');
  const verbs = readFile<VerbsFile>(lang, 'verbs.json');
  const pairs = readFile<PairsFile>(lang, 'pairs.json');
  issues.push(
    ...tag(validateGrammar(grammar)),
    ...tag(validateNpcs(npcs)),
    ...tag(validateChronicler(chronicler, npcs)),
    ...tag(validateGuardians(guardians, CHAPTERS.map((_, i) => i + 1))),
    ...tag(validateVerbs(verbs, lang)),
    ...tag(validatePairs(pairs, lang)),
    ...tag(
      validatePortraits(
        [
          ...(npcs?.npcs ?? []).map((n) => ({ where: `npcs.json ${n.id}`, look: n.look })),
          { where: 'chronicler.json', look: chronicler?.look },
          ...(guardians?.guardians ?? []).map((g) => ({ where: `guardians.json глава ${g.chapter}`, look: g.look })),
          { where: 'verbs.json кузнец', look: verbs?.smith?.look },
        ],
        (name) => existsSync(join(root, '..', 'assets', 'portraits', lang, `${name}.webp`)),
      ),
    ),
    ...textChecks(lang),
    ...tag(partialWordChecks(lang, words, scrolls, grammar.map((g) => g.data))),
    ...tag(partialStoryChecks(lang, npcs, words, scrolls, grammar.map((g) => g.data))),
  );
  const thread = readFile<ThreadFile>(lang, 'scenes/thread.json');
  const books = existsSync(join(root, lang, 'books')) ? readJson<BookFile>(join(root, lang, 'books')) : [];
  const rumors = readFile<RumorsFile>(lang, 'rumors.json');
  const diary = readFile<DiaryFile>(lang, 'diary.json');
  const wordCount = words.reduce((n, f) => n + f.data.words.length, 0) + scrolls.reduce((n, f) => n + f.data.words.length, 0);
  const count = (dir: string, key: 'phrases' | 'scenes' | 'missions') =>
    readJson<Record<typeof key, unknown[]>>(join(root, lang, dir)).filter((f) => f.name !== 'thread.json').reduce((n, f) => n + (f.data[key]?.length ?? 0), 0);
  summary.push(`${lang} (курс закрыт): слов ${wordCount} в ${words.length} местах и ${scrolls.length} свитках, ${grammar.length} уроков, ${count('phrases', 'phrases')} фраз, ${count('scenes', 'scenes')} сцен, ${count('missions', 'missions')} миссий, ${npcs?.npcs.length ?? 0} жителей, ${guardians?.guardians.length ?? 0} стражей, ${verbs?.verbs.length ?? 0} глаголов в кузнице, ${pairs?.contrasts.reduce((n, c) => n + c.pairs.length, 0) ?? 0} пар в Звоннице${existsSync(join(root, lang, 'prologue.json')) ? ', пролог' : ''}${thread ? `, ${thread.scenes.length} сцен нити глав` : ''}${books.length ? `, ${books.reduce((n, f) => n + f.data.books.length, 0)} книг Летописца` : ''}${rumors ? `, ${rumors.rumors.length} слухов` : ''}${diary ? `, записей дневника: ${diary.entries.length}` : ''}`);
}

for (const lang of langs) {
  if (!LANGS[lang].released) {
    partialChecks(lang);
    continue;
  }
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
  const chroniclerPath = join(root, lang, 'chronicler.json');
  const chronicler = existsSync(chroniclerPath) ? (JSON.parse(readFileSync(chroniclerPath, 'utf8')) as Chronicler) : undefined;
  const scrolls = readJson<ScrollFile>(join(root, lang, 'scrolls'));
  const guardiansPath = join(root, lang, 'guardians.json');
  const verbsPath = join(root, lang, 'verbs.json');
  const verbs = existsSync(verbsPath) ? (JSON.parse(readFileSync(verbsPath, 'utf8')) as VerbsFile) : undefined;
  const pairsPath = join(root, lang, 'pairs.json');
  const pairs = existsSync(pairsPath) ? (JSON.parse(readFileSync(pairsPath, 'utf8')) as PairsFile) : undefined;
  const guardians = existsSync(guardiansPath) ? (JSON.parse(readFileSync(guardiansPath, 'utf8')) as GuardiansFile) : undefined;
  const sphinxPath = join(root, lang, 'sphinx.json');
  const sphinx = existsSync(sphinxPath) ? (JSON.parse(readFileSync(sphinxPath, 'utf8')) as SphinxFile) : undefined;
  const lettersPath = join(root, lang, 'letters.json');
  const letters = existsSync(lettersPath) ? (JSON.parse(readFileSync(lettersPath, 'utf8')) as LettersFile) : undefined;
  // Главы, где есть уроки: у каждой должен быть страж.
  const lessonChapters = [...new Set(grammar.map((g) => chapterOfDistrict((g.data as GrammarLesson).district)?.id ?? 0))].filter(Boolean).sort();
  // Фразы мест: слова фразы должны быть в словаре мест того же уровня или ниже (свиток главы — с первого уровня главы).
  const phrases = readJson<LocationPhrases>(join(root, lang, 'phrases'));
  const dataDir = join(root, '..', '..', 'scripts', 'data');
  const skips = parseSkips(readFileSync(join(dataDir, `skip-${lang}.txt`), 'utf8'));
  const forms = applySkipsToForms(parseLemmas(readFileSync(join(dataDir, `lemmas-${lang}.tsv`), 'utf8')), skips);
  const freq = applySkips(parseFreq(readFileSync(join(dataDir, `freq-${lang}.tsv`), 'utf8')), skips);
  const lexicon = buildLexicon(
    [
      ...words.flatMap((f) => f.data.words),
      ...scrolls.flatMap((f) => f.data.words.map((w) => ({ ...w, level: CHAPTERS[f.data.chapter - 1]?.levels[0] ?? 99 }))),
    ],
    grammar.map((g) => g.data as GrammarLesson),
    freq,
    (t) => lemmasIn(t, forms, lang),
  );
  // Редкие слова на уровнях 1–4 (задача 12.1).
  const ranks = lemmaRanks(
    coverage(freq, { words: new Set(lexicon.wordLevel.keys()), grammar: lexicon.grammar, anywhere: lexicon.anywhere }),
  );
  const rarity: Issue[] = words.flatMap((f) => {
      const plain = f.data.words.filter((w) => !w.kind);
      const levels = [...new Set(plain.map((w) => w.level))].map((level) => ({ level, words: levelWords(plain, level) }));
      return rarityIssues(levels, (es) => wordRank(es, forms, lang, ranks), lessonParts).map(({ id, msg }) => ({
        level: 'warning' as const,
        where: `words/${f.name} ${id}`,
        msg,
      }));
    });
  // CEFR по частотности и рискованные слова (задача 15.2): слова мест и свитков.
  const sources = [
    ...words.map((f) => ({ where: `words/${f.name}`, words: f.data.words })),
    ...scrolls.map((f) => ({ where: `scrolls/${f.name}`, words: f.data.words })),
  ];
  const risky = parseRisky(readFileSync(join(dataDir, `risky-${lang}.txt`), 'utf8'));
  const usage: Issue[] = sources.flatMap(({ where, words: ws }) => [
    ...cefrIssues(ws, (es) => wordRank(es, forms, lang, ranks)).map(({ id, msg }) => ({ level: 'warning' as const, where: `${where} ${id}`, msg })),
    ...riskyIssues(ws, risky, (t) => lemmasIn(t, forms, lang)).map(({ id, msg }) => ({ level: 'warning' as const, where: `${where} ${id}`, msg })),
  ]);
  // Правила перевода (задача 15.3): обращение как в оригинале, «ёлочки», «ё» — во всех файлах контента языка;
  // тем же обходом поле say (задача 15.4) и ошибки текста языка (17.1).
  const translation: Issue[] = textChecks(lang);
  // Праздники: их фразы и миссии опираются и на слова самого праздника, поэтому словарь свой — с ними на уровне 1.
  const festivals = readJson<FestivalFile>(join(root, lang, 'festivals'));
  const festLexicon = buildLexicon(
    [
      ...words.flatMap((f) => f.data.words),
      ...scrolls.flatMap((f) => f.data.words.map((w) => ({ ...w, level: CHAPTERS[f.data.chapter - 1]?.levels[0] ?? 99 }))),
      ...festivals.flatMap((f) => f.data.words ?? []),
    ],
    grammar.map((g) => g.data as GrammarLesson),
    freq,
    (t) => lemmasIn(t, forms, lang),
  );
  const festivalChecks = (data: { name: string; data: FestivalFile }[]) =>
    validateFestivals(data, lang, {
      residents: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])),
      phrases: { lessons: new Set(grammar.map((g) => (g.data as GrammarLesson).id)), uncovered: (text, level) => uncoveredWords(text, level, festLexicon, forms, lang) },
      missions: { scenes: new Set(), coverage: (text, level) => textCoverage(text, level, festLexicon, forms, lang) },
    });
  // Сцены: доля незнакомых слов к уровню главы, отчёт покрытия в итоговой строке.
  // Нить глав (задача 13.1) лежит рядом со сценами мест, но проверяется своей функцией.
  const sceneFiles = readJson<LocationScenes>(join(root, lang, 'scenes'));
  const scenes = sceneFiles.filter((f) => f.name !== 'thread.json');
  const threadFile = sceneFiles.find((f) => f.name === 'thread.json') as { name: string; data: ThreadFile } | undefined;
  const threadChecks = {
    chronicler: chronicler?.id ?? '',
    residents: (npcs?.npcs ?? []).map((n) => n.id),
    chapters: THREAD_CHAPTERS,
    notesMin: THREAD_NOTES_MIN,
    coverage: (text: string, level: number) => textCoverage(text, level, lexicon, forms, lang),
  };
  const threadCheck = validateThread(threadFile, threadChecks);
  // Книги Летописца (задача 12.4).
  const books = existsSync(join(root, lang, 'books')) ? readJson<BookFile>(join(root, lang, 'books')) : [];
  const bookIssues = validateBooks(books, { chapters: BOOK_CHAPTERS, coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang), gender: LANGS[lang].gender });
  const sceneCheck = validateScenes(scenes, {
    residents: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])),
    pitch: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.id, n.voice.pitch])),
    coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang),
  });
  const missions = readJson<LocationMissions>(join(root, lang, 'missions'));
  const missionIssues = validateMissions(missions, {
    residents: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])),
    registers: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.register])),
    phrases: Object.fromEntries(phrases.map((f) => [f.data.location, f.data.phrases])),
    scenes: new Set(scenes.flatMap((f) => f.data.scenes.map((sc) => sc.id))),
    coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang),
  });
  // Слухи города (задача 13.7).
  const rumorsPath = join(root, lang, 'rumors.json');
  const rumorIssues = validateRumors(
    existsSync(rumorsPath) ? JSON.parse(readFileSync(rumorsPath, 'utf8')) : undefined,
    new Set([...(npcs?.npcs ?? []).map((n) => n.id), ...(chronicler ? [chronicler.id] : [])]),
    (text, level) => textCoverage(text, level, lexicon, forms, lang),
  );
  // Дневник путника (задача 13.8): цитаты — реплики разговоров, сцен Летописца и слухи.
  const diaryPath = join(root, lang, 'diary.json');
  const diaryIssues = validateDiary(existsSync(diaryPath) ? JSON.parse(readFileSync(diaryPath, 'utf8')) : undefined, {
    scenes: [...scenes.flatMap((f) => f.data.scenes ?? []), ...(threadFile?.data.scenes ?? [])],
    rumors: existsSync(rumorsPath) ? JSON.parse(readFileSync(rumorsPath, 'utf8')).rumors : [],
  });
  // Выбор с последствиями (задача 13.6): развилки миссий и реплики с условием.
  const storyIssues = validateStory(scenes, missions, threadFile, STORY_FORKS);
  // Женские формы (`fem`): у путницы те же проверки сцен, миссий, фраз и писем, что у исходного текста,
  // и своя проверка самих форм (не пустая, есть исходное поле, отличается от него).
  const fem = <T,>(list: { name: string; data: T }[]) => list.map((f) => ({ name: f.name, data: forGender(f.data, 'f') }));
  const femPhrases = fem(phrases);
  const femCheck = [
    ...validateScenes(fem(scenes), {
      residents: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])),
      pitch: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.id, n.voice.pitch])),
      coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang),
    }).issues,
    ...validateMissions(fem(missions), {
      residents: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])),
      registers: Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.register])),
      phrases: Object.fromEntries(femPhrases.map((f) => [f.data.location, f.data.phrases])),
      scenes: new Set(scenes.flatMap((f) => f.data.scenes.map((sc) => sc.id))),
      coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang),
    }),
    ...validatePhrases(femPhrases, {
      lessons: new Set(grammar.map((g) => (g.data as GrammarLesson).id)),
      uncovered: (text, level) => uncoveredWords(text, level, lexicon, forms, lang),
    }),
    ...validateLetters(forGender(letters, 'f'), Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id]))),
    ...validateNotes(forGender(letters, 'f'), Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id]))),
    ...festivalChecks(fem(festivals)),
    ...(threadFile ? validateThread(fem([threadFile])[0], threadChecks).issues : []),
  ]
    // Слова gloss из мужской формы в женской не встречаются: это не лишний перевод, его нажимают у путника.
    .filter((i) => !i.msg.includes('из gloss нет в репликах'))
    .map((i) => ({ ...i, where: `${i.where} (путница)` }));
  const femFiles: [string, unknown][] = [
    ...(threadFile ? [[`scenes/${threadFile.name}`, threadFile.data] as [string, unknown]] : []),
    ...[...scenes.map((f) => ['scenes', f] as const), ...missions.map((f) => ['missions', f] as const), ...phrases.map((f) => ['phrases', f] as const)].map(
      ([dir, f]) => [`${dir}/${f.name}`, f.data] as [string, unknown],
    ),
    ['npcs.json', npcs],
    ['chronicler.json', chronicler],
    ['guardians.json', guardians],
    ['sphinx.json', sphinx],
    ['letters.json', letters],
    ...festivals.map((f) => [`festivals/${f.name}`, f.data] as [string, unknown]),
  ];
  const femForms: Issue[] = femFiles.flatMap(([where, data]) => femIssues(data, where).map((msg) => ({ level: 'error' as const, where, msg })));
  issues.push(
    ...tag(femCheck),
    ...tag(femForms),
    ...tag(missionIssues),
    ...tag(storyIssues),
    ...tag(rumorIssues),
    ...tag(diaryIssues),
    ...tag(sceneCheck.issues),
    ...tag(threadCheck.issues),
    ...tag(bookIssues),
    ...tag(validateWords(words, lang)),
    ...tag(rarity),
    ...tag(usage),
    ...translation,
    ...tag(
      validatePhrases(phrases, {
        lessons: new Set(grammar.map((g) => (g.data as GrammarLesson).id)),
        uncovered: (text, level) => uncoveredWords(text, level, lexicon, forms, lang),
      }),
    ),
    ...tag(validateScrolls(scrolls, words, lang)),
    ...tag(
      validateTranslations(
        [...words, ...festivals.map((f) => ({ name: `festivals/${f.name}`, data: { location: `fest-${f.data.id}` as LocationWords['location'], words: f.data.words ?? [] } }))],
        scrolls,
      ),
    ),
    ...tag(festivalChecks(festivals)),
    ...tag(
      validatePrologue(existsSync(join(root, lang, 'prologue.json')) ? (JSON.parse(readFileSync(join(root, lang, 'prologue.json'), 'utf8')) as PrologueFile) : undefined, {
        words: new Map([...words.flatMap((f) => f.data.words), ...scrolls.flatMap((f) => f.data.words)].map((w) => [w.id, w])),
        uncovered: (text) => uncoveredWords(text, 1, lexicon, forms, lang),
      }),
    ),
    ...tag(validateGrammar(grammar)),
    ...tag(validateNpcs(npcs)),
    ...tag(validateChronicler(chronicler, npcs)),
    ...tag(validateGuardians(guardians, lessonChapters)),
    ...tag(validateVerbs(verbs, lang)),
    ...tag(validatePairs(pairs, lang)),
    ...tag(
      validateSphinx(sphinx, {
        coverage: (text, level) => textCoverage(text, level, lexicon, forms, lang),
        voices: {
          ...Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.id, n.voice.pitch])),
          ...(chronicler ? { [chronicler.id]: chronicler.voice.pitch } : {}),
        },
      }),
    ),
    ...tag(validateLetters(letters, Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])))),
    ...tag(validateNotes(letters, Object.fromEntries((npcs?.npcs ?? []).map((n) => [n.location, n.id])), (text, level) => textCoverage(text, level, lexicon, forms, lang))),
    ...tag(
      validatePortraits(
        [
          ...(npcs?.npcs ?? []).map((n) => ({ where: `npcs.json ${n.id}`, look: n.look })),
          { where: 'chronicler.json', look: chronicler?.look },
          ...(guardians?.guardians ?? []).map((g) => ({ where: `guardians.json глава ${g.chapter}`, look: g.look })),
          { where: 'verbs.json кузнец', look: verbs?.smith?.look },
        ],
        (name) => existsSync(join(root, '..', 'assets', 'portraits', lang, `${name}.webp`)),
      ),
    ),
  );
  // Выражения уровня 7 в цель слов не входят и считаются отдельно.
  const placeCount = words.reduce((n, f) => n + f.data.words.filter((w) => !w.kind).length, 0);
  const exprCount = words.reduce((n, f) => n + f.data.words.filter((w) => w.kind).length, 0);
  const scrollCount = scrolls.reduce((n, f) => n + f.data.words.length, 0);
  const phraseCount = phrases.reduce((n, f) => n + f.data.phrases.length, 0);
  const missionCount = missions.reduce((n, f) => n + f.data.missions.length, 0);
  summary.push(
    `${lang}: ${words.length} локаций, слов: ${placeCount + scrollCount} (из них в свитках ${scrollCount}) из плана ${PLAN_TOTAL}, ${exprCount} ${plural(exprCount, ['выражение', 'выражения', 'выражений'])}, ${grammar.length} уроков, ${phraseCount} ${plural(phraseCount, ['фраза', 'фразы', 'фраз'])}, ${sceneSummary(sceneCheck.report)}, ${threadCheck.report.scenes} ${plural(threadCheck.report.scenes, ['сцена', 'сцены', 'сцен'])} нити глав, ${books.reduce((n, f) => n + f.data.books.length, 0)} книг Летописца, ${missionCount} ${plural(missionCount, ['миссия', 'миссии', 'миссий'])}, ${npcs?.npcs.length ?? 0} жителей, ${verbs?.verbs.length ?? 0} глаголов в кузнице, ${pairs?.contrasts.reduce((n, c) => n + c.pairs.length, 0) ?? 0} пар в Звоннице, ${festivals.length} ${plural(festivals.length, ['праздник', 'праздника', 'праздников'])}, ${letters?.letters.length ?? 0} писем, ${letters?.notes?.length ?? 0} записок`,
  );
}

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

for (const i of warnings) console.warn(`⚠ ${i.where}: ${i.msg}`);
for (const i of errors) console.error(`✗ ${i.where}: ${i.msg}`);

console.log(`Контент: ${summary.join('; ')}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
