import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateChronicler, validateGrammar, validateGuardians, validateLetters, validateMissions, validateNpcs, validatePhrases, validateScenes, validatePortraits, validateScrolls, validateSphinx, validateTranslations, validateVerbs, validatePairs, validateFestivals, validatePrologue, validateThread, validateWords, type Issue } from '../src/content/validate';
import type { Chronicler, GrammarLesson, GuardiansFile, LettersFile, SphinxFile, VerbsFile, PairsFile, FestivalFile, PrologueFile, LocationWords, LocationMissions, LocationPhrases, LocationScenes, NpcsFile, ScrollFile, ThreadFile } from '../src/content/schema';
import { THREAD_CHAPTERS, THREAD_NOTES_MIN } from '../src/domain/thread';
import type { Lang } from '../src/lang';
import { CHAPTERS, PLAN_TOTAL } from '../src/content/vocabPlan';
import { chapterOfDistrict } from '../src/domain/chapters';
import { plural } from '../src/domain/medals';
import { femIssues, forGender } from '../src/domain/address';
import { lessonParts, levelWords } from '../src/domain/levels';
import { applySkips, applySkipsToForms, buildLexicon, coverage, lemmaRanks, rarityIssues, wordRank, lemmasIn, parseFreq, parseSkips, parseLemmas, textCoverage, uncoveredWords } from './vocab-lib';

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
    ...tag(sceneCheck.issues),
    ...tag(threadCheck.issues),
    ...tag(validateWords(words, lang)),
    ...tag(rarity),
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
    ...tag(validateGrammar(grammar, lang)),
    ...tag(validateNpcs(npcs)),
    ...tag(validateChronicler(chronicler, npcs)),
    ...tag(validateGuardians(guardians, lessonChapters)),
    ...tag(validateVerbs(verbs, lang)),
    ...tag(validatePairs(pairs)),
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
    `${lang}: ${words.length} локаций, слов: ${placeCount + scrollCount} (из них в свитках ${scrollCount}) из плана ${PLAN_TOTAL}, ${exprCount} ${plural(exprCount, ['выражение', 'выражения', 'выражений'])}, ${grammar.length} уроков, ${phraseCount} ${plural(phraseCount, ['фраза', 'фразы', 'фраз'])}, ${sceneSummary(sceneCheck.report)}, ${threadCheck.report.scenes} ${plural(threadCheck.report.scenes, ['сцена', 'сцены', 'сцен'])} нити глав, ${missionCount} ${plural(missionCount, ['миссия', 'миссии', 'миссий'])}, ${npcs?.npcs.length ?? 0} жителей, ${verbs?.verbs.length ?? 0} глаголов в кузнице, ${pairs?.contrasts.reduce((n, c) => n + c.pairs.length, 0) ?? 0} пар в Звоннице, ${festivals.length} ${plural(festivals.length, ['праздник', 'праздника', 'праздников'])}, ${letters?.letters.length ?? 0} писем`,
  );
}

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');

for (const i of warnings) console.warn(`⚠ ${i.where}: ${i.msg}`);
for (const i of errors) console.error(`✗ ${i.where}: ${i.msg}`);

console.log(`Контент: ${summary.join('; ')}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
