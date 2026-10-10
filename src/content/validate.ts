import { normalize, splitArticle, stripAccents } from '../domain/answer';
import type { Lang } from '../lang';
import { CHAPTERS as PLAN, PLACE_EXPRESSIONS, PLACE_LEVEL_MAX } from './vocabPlan';
import { EXPRESSION_LEVEL, isExpression, KINDS, REGISTERS, USAGES } from '../domain/expression';
import { expandOptional, fullPhrase, optionalError, PHRASE_MAX_WORDS, PHRASE_PREFIX, phraseWords } from '../domain/phrase';
import { answersOnPath, DISPUTE_FROM_CHAPTER, isDispute, isRegisterNode, missionGraphIssues, REGISTER_FROM_CHAPTER } from '../domain/mission';
import { LISTEN_GUARDIAN_CHAPTERS } from '../domain/guardian';
import { sceneWords } from '../domain/sceneText';
import { THREAD_TRIGGERS, threadId } from '../domain/thread';
import { conditionGroups, conditionIssues, missionSayChains, storyFlags } from '../domain/story';
import { DIARY_PER_CHAPTER, DIARY_TOPICS } from '../domain/diary';
import { BOOK_QUESTIONS, BOOK_UNKNOWN_MAX, BOOK_WORD_PREFIX, BOOK_WORDS, BOOKS_PER_CHAPTER, bookId, parseBookId, textWords } from '../domain/books';
import { conjugate, generated, participle, TENSES, type Tense } from '../domain/verbs';
import { phraseTokens } from '../domain/phraseSteps';
import { pairIssue } from '../domain/minimalPairs';
import { festivalMissionId, festivalPlace, festivalsOf } from '../domain/festival';
import { LETTER_MAX_WORDS, LETTER_MIN_WORDS, wordCount as letterWords } from '../domain/letter';
import { checkNote, NOTE_SAMPLE_WORDS } from '../domain/note';
import { CHAPTERS } from '../domain/chapters';
import { LOCATION_IDS, SPHINX_LINES, type SphinxSpeaker, type Chronicler, type GrammarExercise, type GrammarLesson, type GuardiansFile, type LettersFile, type NpcLook, type LocationMissions, type MissionAnswer, type LocationPhrases, type LocationScenes, type Phrase, type Scene, type LocationWords, type NpcsFile, type ScrollFile, type SphinxFile, type VerbsFile, type Word, type PairsFile, type Smith, type FestivalFile, type LocationId, type PrologueFile, type ThreadFile, type BookFile } from './schema';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  msg: string;
}

const POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'interj', 'phrase']);
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);

// Женский род, но с артиклем el из-за ударного a- (el agua, el aula).
const STRESSED_A = new Set([
  'agua', 'aula', 'arma', 'área', 'alma', 'ala', 'ave', 'hambre', 'hacha', 'águila', 'ancla', 'asma',
  'hada', 'haba', 'acta', 'arpa', 'aguas', 'alta',
]);

const empty = (v: unknown) => typeof v !== 'string' || v.trim() === '';

// Итальянский: lo/gli перед s+согласная, z, gn, ps, x, y; l' перед гласной.
// Перед h (заимствования) бывает и так и так: la hostess, l'home banking.
const IT_LO = /^(s[^aeiouàèéìòù]|z|gn|ps|x|y)/;
const IT_VOWEL = /^[aeiouàèéìòù]/;

function checkArticleIt(w: Word, form: string, where: string, out: Issue[]) {
  const { article, core } = splitArticle(form, 'it');
  const all = ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'];
  if (!article || !all.includes(article)) {
    out.push({ level: 'error', where, msg: `существительное без определённого артикля: "${form}"` });
    return;
  }
  const expected = w.gender === 'f' ? ['la', "l'", 'le'] : ['il', 'lo', "l'", 'i', 'gli'];
  if (!expected.includes(article)) {
    out.push({ level: 'error', where, msg: `артикль "${article}" не совпадает с родом ${w.gender}` });
    return;
  }
  if (core.startsWith('h')) return;
  const vowel = IT_VOWEL.test(core);
  const lo = IT_LO.test(core);
  let want: string | null = null;
  if (article === "l'" && !vowel) want = w.gender === 'f' ? 'la' : lo ? 'lo' : 'il';
  if ((article === 'il' || article === 'lo' || article === 'la') && vowel) want = "l'";
  if (article === 'il' && lo) want = 'lo';
  if (article === 'lo' && !lo && !vowel) want = 'il';
  if (article === 'i' && (vowel || lo)) want = 'gli';
  if (article === 'gli' && !vowel && !lo) want = 'i';
  if (want) out.push({ level: 'error', where, msg: `перед "${core}" нужен артикль "${want}", а не "${article}"` });
}

function checkArticle(w: Word, form: string, where: string, out: Issue[], lang: Lang = 'es') {
  if (lang === 'it') return checkArticleIt(w, form, where, out);
  const { article, core } = splitArticle(form, 'es');
  if (!article || !['el', 'la', 'los', 'las'].includes(article)) {
    out.push({ level: 'error', where, msg: `существительное без определённого артикля: "${form}"` });
    return;
  }
  const expected = w.gender === 'f' ? ['la', 'las'] : ['el', 'los'];
  const stressedA = w.gender === 'f' && article === 'el' && STRESSED_A.has(core.split(' ')[0]);
  if (!expected.includes(article) && !stressedA) {
    out.push({ level: 'error', where, msg: `артикль "${article}" не совпадает с родом ${w.gender}` });
  }
}

/**
 * Поля выражения (задача 7.1): вид только на уровне 7, регистр у выражения обязателен,
 * у идиомы дословный перевод, у ложного друга пояснение. Сочетание, идиома и формула — фразы.
 */
function checkExpression(w: Word, at: string, out: Issue[]) {
  const err = (msg: string) => out.push({ level: 'error', where: at, msg });
  if (w.register !== undefined && !REGISTERS.includes(w.register)) err(`регистр "${w.register}"`);
  if (w.kind === undefined) {
    for (const f of ['pair', 'literal', 'note'] as const) if (w[f] !== undefined) err(`поле ${f} бывает только у выражения`);
    return;
  }
  if (!KINDS.includes(w.kind)) return err(`вид выражения "${w.kind}"`);
  if (w.level !== EXPRESSION_LEVEL) err(`выражение на уровне ${w.level}, они бывают только на уровне ${EXPRESSION_LEVEL}`);
  if (w.register === undefined) err('у выражения нет регистра');
  if (w.kind !== 'false-friend' && w.pos !== 'phrase') err(`у выражения вида ${w.kind} часть речи phrase, а не ${w.pos}`);
  if (w.kind === 'idiom' ? empty(w.literal) : w.literal !== undefined) err(w.kind === 'idiom' ? 'у идиомы нет literal' : 'literal бывает только у идиомы');
  if (w.kind === 'false-friend' ? empty(w.note) : w.note !== undefined) err(w.kind === 'false-friend' ? 'у ложного друга нет note' : 'note бывает только у ложного друга');
  if (w.pair !== undefined && empty(w.pair)) err('пустой pair');
  // Официальную формулу игрок должен уметь сказать и по-дружески.
  else if (w.kind === 'formula' && w.register === 'formal' && w.pair === undefined) err('у официальной формулы нет разговорной пары');
}

/** Пометка употребления (задача 15.2): известная, пояснение только при пометке, у грубого слова пояснение обязательно. */
function checkUsage(w: Word, at: string, out: Issue[]) {
  const err = (msg: string) => out.push({ level: 'error', where: at, msg });
  if (w.usage !== undefined && !USAGES.includes(w.usage)) err(`пометка usage "${w.usage}"`);
  if (w.usageNote !== undefined && empty(w.usageNote)) err('пустое пояснение usageNote');
  if (w.usageNote !== undefined && w.usage === undefined) err('usageNote без пометки usage');
  if (w.usage === 'vulgar' && empty(w.usageNote)) err('у грубого слова нет пояснения usageNote');
}

/** Пары выражений: ссылка на выражение этого языка, взаимная, регистры разные. */
function checkPairs(all: Map<string, { w: Word; at: string }>, out: Issue[]) {
  for (const { w, at } of all.values()) {
    if (empty(w.pair)) continue;
    const err = (msg: string) => out.push({ level: 'error', where: at, msg });
    if (w.pair === w.id) {
      err('pair ссылается на само выражение');
      continue;
    }
    const other = all.get(w.pair!);
    if (!other) err(`pair "${w.pair}": нет такого слова`);
    else if (!isExpression(other.w)) err(`pair "${w.pair}": это слово, а не выражение`);
    else if (other.w.pair !== w.id) err(`pair "${w.pair}": у него нет обратной ссылки на ${w.id}`);
    else if (other.w.register === w.register) err(`pair "${w.pair}": тот же регистр ${w.register}`);
  }
}

/** Проверки одного слова: поля, часть речи, артикль и род, пример содержит слово. Общие для мест и свитков. */
function checkWord(w: Word, at: string, lang: Lang, out: Issue[]) {
  for (const f of ['id', 'es', 'ru', 'pos', 'cefr'] as const) {
    if (empty(w[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  }
  if (!w.example || empty(w.example.es) || empty(w.example.ru)) {
    out.push({ level: 'error', where: at, msg: 'пустой пример' });
  }
  if (![1, 2, 3, 4, 5, 6, 7].includes(w.level)) out.push({ level: 'error', where: at, msg: `уровень ${w.level}` });
  checkExpression(w, at, out);
  checkUsage(w, at, out);
  if (!POS.has(w.pos)) out.push({ level: 'error', where: at, msg: `часть речи "${w.pos}"` });
  if (!CEFR.has(w.cefr)) out.push({ level: 'error', where: at, msg: `CEFR "${w.cefr}"` });
  if (empty(w.id) || empty(w.es)) return;

  if (w.es !== w.es.trim() || /\s{2,}/.test(w.es)) {
    out.push({ level: 'error', where: at, msg: 'лишние пробелы в es' });
  }

  if (w.pos === 'noun') {
    if (w.gender !== 'm' && w.gender !== 'f') {
      out.push({ level: 'error', where: at, msg: 'у существительного нет рода' });
    } else {
      checkArticle(w, w.es, at, out, lang);
      for (const a of w.alt ?? []) checkArticle(w, a, `${at} (alt)`, out, lang);
    }
  } else {
    if (w.gender) out.push({ level: 'warning', where: at, msg: 'род у не-существительного' });
    if (w.pos !== 'phrase' && w.es.includes(' ') && splitArticle(w.es, lang).article) {
      out.push({ level: 'error', where: at, msg: `артикль у части речи ${w.pos}` });
    }
  }

  for (const a of w.alt ?? []) if (empty(a)) out.push({ level: 'error', where: at, msg: 'пустой alt' });

  if (w.example && !empty(w.example.es) && isExpression(w)) {
    // Выражение в примере часто в другой форме (tomar una decisión → tomé una decisión): хватит одного полного слова.
    const ex = stripAccents(normalize(w.example.es));
    const parts = stripAccents(normalize(w.es)).split(/[\s']+/).filter((t) => t.length > 3);
    const stems = parts.map((t) => (t.length > 5 ? t.slice(0, -2) : t));
    if (stems.length && !stems.some((t) => ex.includes(t))) out.push({ level: 'warning', where: at, msg: `в примере нет выражения "${w.es}"` });
  } else if (w.example && !empty(w.example.es)) {
    const ex = stripAccents(normalize(w.example.es));
    let core = stripAccents(splitArticle(w.es, lang).core);
    // Возвратный глагол: bañarse → bañar, lavarsi → lavar; в примере будет bañarnos, mi lavo.
    if (w.pos === 'verb' && core.endsWith(lang === 'it' ? 'si' : 'se')) core = core.slice(0, -2);
    // У итальянских глаголов окончание длиннее: parlare → parl.
    const cut = lang === 'it' && w.pos === 'verb' && core.length > 5 ? 3 : 2;
    const stem = core.length > 4 ? core.slice(0, core.length - cut) : core;
    if (!ex.includes(stem)) {
      out.push({ level: 'warning', where: at, msg: `в примере нет слова "${w.es}"` });
    }
  }
}

export function validateWords(files: { name: string; data: LocationWords }[], lang: Lang = 'es'): Issue[] {
  const out: Issue[] = [];
  const ids = new Map<string, string>();
  // Одно испанское слово в двух локациях с разным переводом путает варианты ответа.
  const globalEs = new Map<string, string>();
  const all = new Map<string, { w: Word; at: string }>();

  for (const { name, data } of files) {
    const where = name;
    if (!LOCATION_IDS.includes(data.location)) {
      out.push({ level: 'error', where, msg: `неизвестная локация "${data.location}"` });
    }
    if (`${data.location}.json` !== name) {
      out.push({ level: 'error', where, msg: `имя файла не совпадает с location "${data.location}"` });
    }
    if (!Array.isArray(data.words) || data.words.length === 0) {
      out.push({ level: 'error', where, msg: 'нет слов' });
      continue;
    }

    const esSeen = new Map<string, string>();
    // Одинаковый перевод в одном уровне делает упражнение «пары» неоднозначным.
    const ruSeen = new Map<string, string>();
    const perLevel = new Map<number, number>();
    let expressions = 0;

    data.words.forEach((w, i) => {
      const at = `${name}#${i} ${w.id ?? '?'}`;
      checkWord(w, at, lang, out);
      if (empty(w.id) || empty(w.es)) return;
      all.set(w.id, { w, at });

      if (!w.id.startsWith(`${data.location}.`)) {
        out.push({ level: 'error', where: at, msg: `id должен начинаться с "${data.location}."` });
      }
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: `дубль id, уже есть в ${ids.get(w.id)}` });
      ids.set(w.id, name);

      const key = normalize(w.es);
      if (esSeen.has(key)) out.push({ level: 'error', where: at, msg: `дубль "${w.es}" (${esSeen.get(key)})` });
      esSeen.set(key, w.id);

      if (!empty(w.ru)) {
        const rk = `${w.level}:${w.ru.trim().toLowerCase()}`;
        if (ruSeen.has(rk)) out.push({ level: 'warning', where: at, msg: `тот же перевод «${w.ru}», что у ${ruSeen.get(rk)}` });
        else ruSeen.set(rk, w.id);
      }

      // CEFR слова — его собственный, по частотности (задача 15.2, `cefrIssues` в scripts/vocab-lib.ts), а не уровень
      // места. Сочетания, идиомы и формулы главы V всегда C1; ложный друг — обычное слово своей ступени (el balón — A2).
      if (isExpression(w) && w.kind !== 'false-friend' && w.cefr !== 'C1') out.push({ level: 'error', where: at, msg: `у выражения CEFR C1, а не ${w.cefr}` });

      // Выражения идут своим счётом: 25 слов и 15 выражений на уровне 7.
      if (isExpression(w)) expressions++;
      else perLevel.set(w.level, (perLevel.get(w.level) ?? 0) + 1);
    });
    if (expressions > PLACE_EXPRESSIONS) out.push({ level: 'warning', where, msg: `выражений ${expressions}, по плану не больше ${PLACE_EXPRESSIONS}` });

    for (const [key, id] of esSeen) {
      const other = globalEs.get(key);
      if (other) out.push({ level: 'warning', where, msg: `"${key}" уже есть в другой локации (${other})` });
      else globalEs.set(key, id);
    }

    for (const [lvl, n] of perLevel) {
      const max = PLACE_LEVEL_MAX[lvl] ?? 12;
      if (n < 10) out.push({ level: 'error', where, msg: `уровень ${lvl}: ${n} слов, нужно не меньше 10` });
      else if (n > max) out.push({ level: 'warning', where, msg: `уровень ${lvl}: ${n} слов, по плану не больше ${max}` });
    }
  }
  checkPairs(all, out);
  return out;
}

export function validateGrammar(files: { name: string; data: GrammarLesson }[]): Issue[] {
  const out: Issue[] = [];
  const ids = new Map<string, string>();
  const orders = new Map<string, string>();

  for (const { name, data: l } of files) {
    const at = name;
    for (const f of ['id', 'district', 'title'] as const) {
      if (empty(l[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
    }
    if (ids.has(l.id)) out.push({ level: 'error', where: at, msg: `дубль id, уже есть в ${ids.get(l.id)}` });
    // Загрузчик находит урок по id, поэтому id обязан совпадать с путём: a1/01-x.json → a1.01-x.
    const expectedId = name.replace(/\.json$/, '').replace('/', '.');
    if (l.id !== expectedId) out.push({ level: 'error', where: at, msg: `id "${l.id}" не совпадает с путём (${expectedId})` });
    ids.set(l.id, name);
    const ok = `${l.district}:${l.order}`;
    if (orders.has(ok)) out.push({ level: 'error', where: at, msg: `дубль order, уже есть в ${orders.get(ok)}` });
    orders.set(ok, name);

    if (!l.theory?.length) out.push({ level: 'error', where: at, msg: 'нет теории' });
    for (const b of l.theory ?? []) {
      if (b.kind === 'table') {
        if (!b.head.length || !b.rows.length) out.push({ level: 'error', where: at, msg: 'пустая таблица' });
        for (const r of b.rows) {
          if (r.cells.length !== b.head.length) {
            out.push({ level: 'error', where: at, msg: `строка таблицы "${r.cells.join(' | ')}" не совпадает с шапкой` });
          }
          if (r.cells.some(empty)) out.push({ level: 'error', where: at, msg: 'пустая ячейка таблицы' });
        }
      } else if (empty(b.md)) out.push({ level: 'error', where: at, msg: 'пустой блок теории' });
    }

    const exN = l.examples?.length ?? 0;
    if (exN < 3 || exN > 5) out.push({ level: 'error', where: at, msg: `примеров ${exN}, нужно 3-5` });
    for (const e of l.examples ?? []) {
      if (empty(e.es) || empty(e.ru)) out.push({ level: 'error', where: at, msg: 'пустой пример' });
    }

    if ((l.exercises?.length ?? 0) < 3) out.push({ level: 'error', where: at, msg: 'меньше 3 упражнений' });
    const kinds = new Set((l.exercises ?? []).map((e) => e.kind));
    // С задачи 5.3 в каждом уроке есть и продуктивные задания: сборка и ввод формы.
    for (const k of ['choose', 'gap', 'truefalse', 'build', 'type']) {
      if (!kinds.has(k as never)) out.push({ level: 'error', where: at, msg: `нет упражнения типа ${k}` });
    }
    const exIds = new Set<string>();
    const idForm = new RegExp(`^${l.id?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[1-9]\\d*$`);
    (l.exercises ?? []).forEach((e, i) => {
      const w = `${at} упр.${i + 1}`;
      if (empty(e.id)) out.push({ level: 'error', where: w, msg: 'нет id: запустите npx tsx scripts/add-exercise-ids.ts' });
      else if (!idForm.test(e.id)) out.push({ level: 'error', where: w, msg: `id "${e.id}" не вида ${l.id}.<номер>` });
      else if (exIds.has(e.id)) out.push({ level: 'error', where: w, msg: `дубль id ${e.id}` });
      exIds.add(e.id);
      checkExercise(e, w, out);
    });
  }
  return out;
}

/** Одно упражнение грамматики: общее для уроков и Сфинкса. */
function checkExercise(e: GrammarExercise, w: string, out: Issue[]) {
  if (empty(e.explain)) out.push({ level: 'error', where: w, msg: 'нет explain' });
  if (e.kind === 'truefalse') {
    if (empty(e.statement) || typeof e.answer !== 'boolean') out.push({ level: 'error', where: w, msg: 'битое верно/неверно' });
    return;
  }
  if (e.kind === 'build') {
    checkBuildExercise(e, w, out);
    return;
  }
  if (e.kind === 'type') {
    checkTypeExercise(e, w, out);
    return;
  }
  if (checkC1Exercise(e, w, out)) return;
  if (!('options' in e)) return;
  if (e.options.length < 2 || e.options.some(empty)) out.push({ level: 'error', where: w, msg: 'мало или пустые варианты' });
  if (new Set(e.options.map(normalize)).size !== e.options.length) out.push({ level: 'error', where: w, msg: 'одинаковые варианты' });
  if (!Number.isInteger(e.answer) || e.answer < 0 || e.answer >= e.options.length) {
    out.push({ level: 'error', where: w, msg: `answer ${e.answer} вне вариантов` });
  }
  if (e.kind === 'gap') {
    const gaps = e.sentence.split('___').length - 1;
    if (gaps !== 1) out.push({ level: 'error', where: w, msg: `в предложении ${gaps} пропусков вместо одного` });
    if (empty(e.ru)) out.push({ level: 'error', where: w, msg: 'нет перевода' });
  } else if (e.kind === 'choose' && empty(e.prompt)) out.push({ level: 'error', where: w, msg: 'пустой prompt' });
}

/** Сколько слов в собираемом предложении и лишних плиток. */
export const BUILD_WORDS = [3, 12] as const;
export const BUILD_EXTRA = [1, 3] as const;

/**
 * Сборка предложения: перевод, ответ из 3–12 слов, 1–3 лишних плитки, которых нет в ответе
 * (иначе лишняя подходила бы на место нужной), `alt` — другой порядок тех же слов.
 */
function checkBuildExercise(e: { ru: string; answer: string; alt?: string[]; extra: string[] }, w: string, out: Issue[]) {
  if (empty(e.ru)) out.push({ level: 'error', where: w, msg: 'нет перевода' });
  if (empty(e.answer)) {
    out.push({ level: 'error', where: w, msg: 'нет ответа' });
    return;
  }
  const words = phraseTokens(e.answer).map(normalize);
  if (words.length < BUILD_WORDS[0] || words.length > BUILD_WORDS[1]) {
    out.push({ level: 'error', where: w, msg: `в сборке ${words.length} слов, нужно ${BUILD_WORDS[0]}–${BUILD_WORDS[1]}` });
  }
  const extra = e.extra ?? [];
  if (extra.length < BUILD_EXTRA[0] || extra.length > BUILD_EXTRA[1] || extra.some(empty)) {
    out.push({ level: 'error', where: w, msg: `лишних плиток ${extra.length}, нужно ${BUILD_EXTRA[0]}–${BUILD_EXTRA[1]}` });
  }
  for (const x of extra) {
    if (!empty(x) && words.includes(normalize(x))) out.push({ level: 'error', where: w, msg: `лишняя плитка «${x}» есть в ответе` });
    if (!empty(x) && phraseTokens(x).length !== 1) out.push({ level: 'error', where: w, msg: `лишняя плитка «${x}» не одно слово` });
  }
  const bag = (t: string) => phraseTokens(t).map(normalize).sort().join(' ');
  for (const a of e.alt ?? []) {
    if (empty(a) || bag(a) !== bag(e.answer)) out.push({ level: 'error', where: w, msg: `alt «${a}» собирается не из тех же слов` });
    else if (normalize(a) === normalize(e.answer)) out.push({ level: 'error', where: w, msg: `alt «${a}» совпадает с ответом` });
  }
}

/** Число слов в строке. */
const wordCount = (s: string) => s.trim().split(/\s+/).length;

/** Непустые ответ и `alt`, каждый содержит слово `must` (ключевое слово пересказа или связку). */
function checkAnswers(answers: string[], must: string | null, what: string, w: string, out: Issue[]) {
  if (!answers.length || answers.some(empty)) {
    out.push({ level: 'error', where: w, msg: 'пустой ответ' });
    return;
  }
  if (must === null) return;
  const re = new RegExp(`(^|\\s)${normalize(must).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  for (const a of answers) if (!re.test(normalize(a))) out.push({ level: 'error', where: w, msg: `в ответе «${a}» нет ${what} «${must}»` });
}

/**
 * Задания уровня C1 (задача 7.3). Возвращает true, если вид из них: тогда общая проверка вариантов не нужна
 * (кроме выбора в регистре и пересказа смысла, у которых свои варианты).
 */
function checkC1Exercise(e: GrammarLesson['exercises'][number], w: string, out: Issue[]): boolean {
  const err = (msg: string) => out.push({ level: 'error', where: w, msg });
  switch (e.kind) {
    case 'transform':
      if (empty(e.source) || empty(e.keyword)) err('нет исходной фразы или ключевого слова');
      checkAnswers([e.answer, ...(e.alt ?? [])], e.keyword ?? '', 'ключевого слова', w, out);
      if (!empty(e.source) && !empty(e.answer) && normalize(e.source) === normalize(e.answer)) err('ответ совпадает с исходной фразой');
      return true;
    case 'combine':
      if (empty(e.first) || empty(e.second) || empty(e.connector)) err('нет одной из фраз или связки');
      checkAnswers([e.answer, ...(e.alt ?? [])], e.connector ?? '', 'связки', w, out);
      return true;
    case 'cloze': {
      const gaps = (e.text ?? '').split('___').length - 1;
      if (gaps < 2) err(`в тексте ${gaps} пропусков, нужно не меньше двух`);
      if (gaps !== (e.answers ?? []).length) err(`пропусков ${gaps}, а списков ответов ${(e.answers ?? []).length}`);
      for (const list of e.answers ?? []) {
        if (!list.length || list.some(empty)) err('пустой список ответов у пропуска');
        else if (list.some((a) => wordCount(a) > 3)) err(`ответ пропуска «${list.join(' / ')}» длиннее трёх слов`);
      }
      return true;
    }
    case 'fix': {
      const words = empty(e.sentence) ? [] : e.sentence.trim().split(/\s+/);
      if (!Number.isInteger(e.wrong) || e.wrong < 0 || e.wrong >= words.length) err(`слово с ошибкой №${e.wrong} вне предложения`);
      checkAnswers([e.answer, ...(e.alt ?? [])], null, '', w, out);
      const bad = words[e.wrong];
      if (bad && !empty(e.answer) && normalize(bad) === normalize(e.answer)) err(`«${bad}» совпадает с верной формой`);
      if (!empty(e.answer) && wordCount(e.answer) > 2) err(`верная форма «${e.answer}» длиннее двух слов`);
      return true;
    }
    case 'register':
      if (empty(e.source)) err('нет исходной фразы');
      if (!REGISTERS.includes(e.to)) err(`регистр "${e.to}"`);
      if ('options' in e) return false;
      checkBuildExercise({ ...e, ru: e.source }, w, out);
      return true;
    case 'paraphrase':
      if (empty(e.sentence)) err('нет исходной фразы');
      else if ((e.options ?? []).some((o) => normalize(o) === normalize(e.sentence))) err('вариант повторяет исходную фразу');
      return false;
    default:
      return false;
  }
}

/** Ввод формы: один пропуск `___`, перевод, ответ и `alt` непустые, ответ — не больше трёх слов. */
function checkTypeExercise(e: { sentence: string; ru: string; answer: string; alt?: string[]; hint?: string }, w: string, out: Issue[]) {
  const gaps = (e.sentence ?? '').split('___').length - 1;
  if (gaps !== 1) out.push({ level: 'error', where: w, msg: `в предложении ${gaps} пропусков вместо одного` });
  if (empty(e.ru)) out.push({ level: 'error', where: w, msg: 'нет перевода' });
  if (empty(e.answer) || (e.alt ?? []).some(empty)) out.push({ level: 'error', where: w, msg: 'пустой ответ' });
  else if (e.answer.trim().split(/\s+/).length > 3) out.push({ level: 'error', where: w, msg: `ответ «${e.answer}» длиннее трёх слов` });
  if (e.hint !== undefined && empty(e.hint)) out.push({ level: 'error', where: w, msg: 'пустая подсказка' });
}

const NPC_STYLES = new Set(['short', 'long', 'bun', 'curly', 'bald']);
const NPC_EXTRAS = new Set(['apron', 'glasses', 'headphones', 'chefhat', 'mustache', 'beard', 'cap', 'tie', 'headband', 'badge', 'stethoscope']);
const COLOR = /^#[0-9a-f]{6}$/i;

/** Общие проверки жителя и Летописца: поля, голос, формулировки поручений, тёплые приветствия, портрет. */
function checkNpc(n: Chronicler, at: string, noun: string, out: Issue[]) {
  for (const f of ['id', 'name', 'role', 'character'] as const) if (empty(n[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  if (empty(n.greeting?.es) || empty(n.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
  if (n.gender !== 'm' && n.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${n.gender}"` });
  const { pitch, rate } = n.voice ?? {};
  if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
  const er = n.errands ?? [];
  if (er.length < 3 || er.length > 4) out.push({ level: 'error', where: at, msg: `формулировок поручения ${er.length}, нужно 3–4` });
  for (const t of er) {
    if (empty(t) || !t.includes('{n}') || !t.includes(noun)) out.push({ level: 'error', where: at, msg: `поручение без {n} или ${noun}: «${t}»` });
  }
  if (n.warm?.length !== 3 || n.warm.some((w) => empty(w?.es) || empty(w?.ru))) {
    out.push({ level: 'error', where: at, msg: 'нужно 3 тёплых приветствия (warm) с переводом' });
  }
  checkLook(n.look, at, out);
}

/** Портрет жителя или стража: тон кожи, причёска, цвета, известные детали. */
function checkLook(lk: NpcLook | undefined, at: string, out: Issue[]) {
  if (!lk || ![1, 2, 3, 4].includes(lk.skin) || !NPC_STYLES.has(lk.style) || !COLOR.test(lk.hair) || !COLOR.test(lk.outfit) || !COLOR.test(lk.pants)) {
    out.push({ level: 'error', where: at, msg: 'неверный портрет (look)' });
  } else {
    for (const e of lk.extra) if (!NPC_EXTRAS.has(e)) out.push({ level: 'error', where: at, msg: `неизвестная деталь портрета "${e}"` });
  }
}

/**
 * Стражи земель (задача 5.4): у каждой главы из `chapters` (главы, где есть уроки грамматики) свой страж, один на главу;
 * имя, роль, пол, реплики с переводом (приветствие, победа, неудача), голос в пределах, портрет.
 */
export function validateGuardians(file: GuardiansFile | undefined, chapters: number[]): Issue[] {
  const out: Issue[] = [];
  const where = 'guardians.json';
  if (!file) return chapters.length ? [{ level: 'error', where, msg: 'нет файла стражей' }] : [];
  const seen = new Set<number>();
  file.guardians.forEach((g, i) => {
    const at = `${where}#${i} глава ${g.chapter}`;
    if (seen.has(g.chapter)) out.push({ level: 'error', where: at, msg: 'второй страж той же главы' });
    seen.add(g.chapter);
    if (!chapters.includes(g.chapter)) out.push({ level: 'error', where: at, msg: 'у главы нет уроков грамматики' });
    for (const f of ['name', 'role'] as const) if (empty(g[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
    if (g.gender !== 'm' && g.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${g.gender}"` });
    for (const f of ['greeting', 'win', 'lose', 'mid'] as const) if (empty(g[f]?.es) || empty(g[f]?.ru)) out.push({ level: 'error', where: at, msg: `пустая реплика ${f}` });
    const { pitch, rate } = g.voice ?? {};
    if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
    checkLook(g.look, at, out);
    // Хранительница леса слушает шёпоты: её испытание — на слух.
    if (LISTEN_GUARDIAN_CHAPTERS.includes(g.chapter) && g.listen !== true) out.push({ level: 'error', where: at, msg: 'страж этой главы проверяет на слух: нужно listen: true' });
  });
  for (const ch of chapters) if (!seen.has(ch)) out.push({ level: 'error', where, msg: `нет стража главы ${ch}` });
  return out;
}

/** Пунктов в чек-листе письма: обращение, связки, вежливая формула, прощание, регистр. */
export const LETTER_CHECKS = [4, 6] as const;

/**
 * Письма с образцом (задача 7.7): id `lt:<место>`, одно письмо на место, у места есть житель, регистр из списка,
 * просьба и задание не пустые, образец 40–80 слов, в чек-листе 4–6 пунктов, и каждый пример пункта есть в образце дословно.
 */
export function validateLetters(file: LettersFile | undefined, residents: Record<string, string>): Issue[] {
  const out: Issue[] = [];
  if (!file) return out;
  const seen = new Set<string>();
  file.letters.forEach((l, i) => {
    const at = `letters.json#${i} ${l.id}`;
    const err = (msg: string) => out.push({ level: 'error', where: at, msg });
    if (l.id !== `lt:${l.location}`) err(`id должен быть lt:${l.location}`);
    if (seen.has(l.location)) err('второе письмо того же места');
    seen.add(l.location);
    if (!(LOCATION_IDS as readonly string[]).includes(l.location)) err(`место "${l.location}"`);
    else if (!residents[l.location]) err('у места нет жителя');
    if (!REGISTERS.includes(l.register)) err(`регистр "${l.register}"`);
    if (!Number.isInteger(l.chapter) || l.chapter < 1 || l.chapter > 5) err(`глава ${l.chapter}`);
    for (const f of ['title', 'task', 'sample'] as const) if (empty(l[f])) err(`пустое поле ${f}`);
    if (empty(l.request?.es) || empty(l.request?.ru)) err('пустая просьба жителя');
    const n = letterWords(l.sample ?? '');
    if (n < LETTER_MIN_WORDS || n > LETTER_MAX_WORDS) err(`в образце ${n} слов, нужно ${LETTER_MIN_WORDS}–${LETTER_MAX_WORDS}`);
    const checks = l.checks ?? [];
    if (checks.length < LETTER_CHECKS[0] || checks.length > LETTER_CHECKS[1]) err(`пунктов чек-листа ${checks.length}, нужно ${LETTER_CHECKS.join('–')}`);
    for (const c of checks) {
      if (empty(c.label) || !c.examples?.length) err('пункт чек-листа без названия или примеров');
      for (const e of c.examples ?? []) if (empty(e) || !(l.sample ?? '').includes(e)) err(`пример «${e}» не найден в образце`);
    }
  });
  return out;
}

/** Записки (задача 12.5): главы и сколько записок в каждой. */
export const NOTE_CHAPTERS = [2, 3, 4] as const;
export const NOTES_PER_CHAPTER = 3;
/** Пунктов `must` в записке. */
export const NOTE_MUST = [2, 4] as const;
/** Доля незнакомых слов в образце к уровню главы: записка короткая, поэтому чуть свободнее, чем у сцен. */
export const NOTE_UNKNOWN_MAX = 0.1;

/**
 * Записки жителям: id `nt:<место>`, одна на место, по три на главу II–IV, образец 15–30 слов, и в образце есть
 * всё из `must` (иначе проверка ругала бы и образцовую записку).
 */
export function validateNotes(
  file: LettersFile | undefined,
  residents: Record<string, string>,
  coverage?: (text: string, level: number) => { total: number; unknown: string[] },
): Issue[] {
  const out: Issue[] = [];
  const notes = file?.notes ?? [];
  const seen = new Set<string>();
  notes.forEach((n, i) => {
    const at = `letters.json#notes.${i} ${n.id}`;
    const err = (msg: string) => out.push({ level: 'error', where: at, msg });
    if (n.id !== `nt:${n.location}`) err(`id должен быть nt:${n.location}`);
    if (seen.has(n.location)) err('вторая записка того же места');
    seen.add(n.location);
    if (!(LOCATION_IDS as readonly string[]).includes(n.location)) err(`место "${n.location}"`);
    else if (!residents[n.location]) err('у места нет жителя');
    if (!REGISTERS.includes(n.register)) err(`регистр "${n.register}"`);
    if (!(NOTE_CHAPTERS as readonly number[]).includes(n.chapter)) err(`глава ${n.chapter}, записки — в главах ${NOTE_CHAPTERS.join(', ')}`);
    for (const f of ['title', 'task', 'sample'] as const) if (empty(n[f])) err(`пустое поле ${f}`);
    if (empty(n.request?.es) || empty(n.request?.ru)) err('пустая просьба жителя');
    const words = letterWords(n.sample ?? '');
    if (words < NOTE_SAMPLE_WORDS[0] || words > NOTE_SAMPLE_WORDS[1]) err(`в образце ${words} слов, нужно ${NOTE_SAMPLE_WORDS.join('–')}`);
    const must = n.must ?? [];
    if (must.length < NOTE_MUST[0] || must.length > NOTE_MUST[1]) err(`пунктов must ${must.length}, нужно ${NOTE_MUST.join('–')}`);
    must.forEach((m, k) => {
      if (empty(m.label) || empty(m.hint) || !m.any?.length || m.any.some(empty)) err(`must ${k}: нужны label, hint и варианты any`);
    });
    for (const k of checkNote(n.sample ?? '', must).missing) err(`в образце нет «${must[k].label}»`);
    const level = CHAPTERS[n.chapter - 1]?.levels.at(-1);
    if (coverage && level && n.sample) {
      const c = coverage(n.sample, level);
      if (c.unknown.length > Math.floor(c.total * NOTE_UNKNOWN_MAX)) err(`незнакомых слов к главе ${n.chapter}: ${c.unknown.join(', ')}`);
    }
  });
  for (const ch of NOTE_CHAPTERS) {
    const count = notes.filter((n) => n.chapter === ch).length;
    if (file && count !== NOTES_PER_CHAPTER) out.push({ level: 'error', where: 'letters.json notes', msg: `записок главы ${ch}: ${count}, нужно ${NOTES_PER_CHAPTER}` });
  }
  return out;
}

/** Сколько глаголов должно быть в кузнице. */
/** Наборов в каждом раунде Сфинкса: повторная попытка идёт по другому набору. */
export const SPHINX_SETS = 3;
/** Загадка слова: сколько заданий каждого вида в наборе, одинаково во всех наборах. */
export const SPHINX_WORD_MIX: Partial<Record<GrammarExercise['kind'], number>> = { transform: 3, cloze: 2, fix: 3, type: 2 };
/** Уровень слов, которые Сфинкс вправе ждать от героя: всё до уровня 7 (C1) и свитки. */
export const SPHINX_LEVEL = 7;
/** Доля незнакомых слов в наборе, как у сцен. */
export const SPHINX_UNKNOWN_MAX = 0.07;

/** Загадка слуха: вопросов каждого вида в наборе — к монологу и к спору, одинаково во всех наборах. */
export const SPHINX_HEAR_MIX: Record<'monologue' | 'dispute', Record<'gist' | 'stance' | 'hint', number>> = {
  monologue: { gist: 2, stance: 1, hint: 1 },
  dispute: { gist: 1, stance: 2, hint: 1 },
};
/** Слов в монологе: около одной-двух минут озвучки. */
export const SPHINX_MONOLOGUE_WORDS = [150, 260] as const;
/** Реплик в споре и у каждого из двух говорящих. */
export const SPHINX_DISPUTE_LINES = 8;
export const SPHINX_DISPUTE_EACH = 3;

export interface SphinxChecks {
  /** Слова текста: всего и незнакомые к уровню (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
  /** Кто может говорить в загадке слуха: id жителя или Летописца → высота голоса. */
  voices?: Record<string, number>;
}

/** Весь текст задания, по которому считаются незнакомые слова: условие и ответы. */
function exerciseText(e: GrammarExercise): string {
  switch (e.kind) {
    case 'transform': return [e.source, e.answer].join(' ');
    case 'cloze': return [e.text, ...e.answers.map((a) => a[0])].join(' ');
    case 'fix': return [e.sentence, e.answer].join(' ');
    case 'type': return [e.sentence, e.answer].join(' ');
    default: return '';
  }
}

/** Что видит герой: по этому тексту одно задание не должно повторяться в разных наборах. */
function exercisePrompt(e: GrammarExercise): string {
  switch (e.kind) {
    case 'transform': return e.source;
    case 'cloze': return e.text;
    case 'fix': case 'type': return e.sentence;
    default: return e.id;
  }
}

/**
 * Сфинкс: `sphinx.json`. Три набора в раунде, id по порядку; в загадке слова в каждом наборе одинаковый состав
 * заданий (`SPHINX_WORD_MIX`), только виды с вводом ответа, задания проходят проверку уроков, не повторяются
 * между наборами, незнакомых слов к уровню 7 не больше 7%.
 */
export function validateSphinx(file: SphinxFile | undefined, checks: SphinxChecks = {}): Issue[] {
  const out: Issue[] = [];
  const where = 'sphinx.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла Сфинкса' }];
  const sets = file.word ?? [];
  if (sets.length !== SPHINX_SETS) out.push({ level: 'error', where, msg: `загадка слова: наборов ${sets.length}, нужно ${SPHINX_SETS}` });
  const prompts = new Map<string, string>();
  sets.forEach((set, i) => {
    const at = `${where} ${set.id ?? `word#${i + 1}`}`;
    const id = `sx:word.${i + 1}`;
    if (set.id !== id) out.push({ level: 'error', where: at, msg: `id набора должен быть "${id}"` });
    const mix: Record<string, number> = {};
    (set.exercises ?? []).forEach((e, k) => {
      const w = `${at} упр.${k + 1}`;
      if (e.id !== `${id}.${k + 1}`) out.push({ level: 'error', where: w, msg: `id задания должен быть "${id}.${k + 1}"` });
      mix[e.kind] = (mix[e.kind] ?? 0) + 1;
      if (!(e.kind in SPHINX_WORD_MIX)) {
        out.push({ level: 'error', where: w, msg: `вид "${e.kind}" не для загадки слова` });
        return;
      }
      checkExercise(e, w, out);
      const p = normalize(exercisePrompt(e));
      if (prompts.has(p)) out.push({ level: 'error', where: w, msg: `задание уже есть в ${prompts.get(p)}` });
      prompts.set(p, e.id);
    });
    for (const [kind, n] of Object.entries(SPHINX_WORD_MIX)) {
      if ((mix[kind] ?? 0) !== n) out.push({ level: 'error', where: at, msg: `заданий ${kind}: ${mix[kind] ?? 0}, нужно ${n}` });
    }
    if (checks.coverage) {
      const { total, unknown } = checks.coverage((set.exercises ?? []).map(exerciseText).join(' '), SPHINX_LEVEL);
      if (total && unknown.length / total > SPHINX_UNKNOWN_MAX) {
        out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round((unknown.length / total) * 100)}% (${[...new Set(unknown)].join(', ')}), не больше ${SPHINX_UNKNOWN_MAX * 100}%` });
      }
    }
  });
  out.push(...hearIssues(file.hear ?? [], checks), ...wisdomIssues(file.wisdom ?? [], checks), ...speakerIssues(file.sphinx, checks));
  return out;
}

/** Реплики Сфинкса: имя, голос, все реплики с переводом, незнакомые слова в `gloss`. */
function speakerIssues(sp: SphinxSpeaker | undefined, checks: SphinxChecks): Issue[] {
  const out: Issue[] = [];
  const at = 'sphinx.json sphinx';
  if (!sp) return [{ level: 'error', where: at, msg: 'нет реплик Сфинкса' }];
  if (empty(sp.name)) out.push({ level: 'error', where: at, msg: 'нет имени' });
  if (!(sp.voice?.pitch > 0) || !(sp.voice?.rate > 0)) out.push({ level: 'error', where: at, msg: 'нет голоса' });
  const lines = SPHINX_LINES.map((k) => sp.speech?.[k]);
  SPHINX_LINES.forEach((k, i) => {
    if (empty(lines[i]?.es) || empty(lines[i]?.ru)) out.push({ level: 'error', where: `${at} ${k}`, msg: 'нет реплики или перевода' });
  });
  const vault = [...(sp.vault?.before ?? []), ...(sp.vault?.after ?? [])];
  if (!sp.vault?.before?.length || !sp.vault?.after?.length) out.push({ level: 'error', where: `${at} vault`, msg: 'нужны реплики до Эликсира и после' });
  vault.forEach((l, i) => {
    if (l.who !== 'sphinx' && l.who !== 'cronista') out.push({ level: 'error', where: `${at} vault#${i + 1}`, msg: `говорит "${l.who}": нужен sphinx или cronista` });
    if (empty(l.es) || empty(l.ru)) out.push({ level: 'error', where: `${at} vault#${i + 1}`, msg: 'нет реплики или перевода' });
  });
  const texts = [...lines.map((l) => l?.es ?? ''), ...vault.map((l) => l.es ?? '')];
  const gloss = glossIssues(texts, sp.gloss, at, out);
  coverageIssues(texts.join(' '), gloss, at, checks, out);
  return out;
}

/** Слова, которые можно нажать в тексте, и проверка `gloss`: пустой перевод — ошибка, слова нет в тексте — предупреждение. */
function glossIssues(texts: string[], glossIn: Record<string, string> | undefined, at: string, out: Issue[]): Record<string, string> {
  const keys = new Set(texts.flatMap((t) => sceneWords(t).flatMap((p) => ('key' in p ? [normalize(p.key)] : []))));
  const gloss = Object.fromEntries(Object.entries(glossIn ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const [k, v] of Object.entries(gloss)) {
    if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
    if (!keys.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в тексте` });
  }
  return gloss;
}

/** Незнакомые слова текста к уровню 7: не больше 7%, и каждое переведено в `gloss`. */
function coverageIssues(text: string, gloss: Record<string, string>, at: string, checks: SphinxChecks, out: Issue[]) {
  if (!checks.coverage) return;
  const cov = checks.coverage(text, SPHINX_LEVEL);
  const share = cov.total ? cov.unknown.length / cov.total : 0;
  if (share > SPHINX_UNKNOWN_MAX) {
    out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${SPHINX_UNKNOWN_MAX * 100}%` });
  }
  const bare = [...new Set(cov.unknown)].filter((t) => !gloss[t]);
  if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре до уровня ${SPHINX_LEVEL} и в gloss: ${bare.join(', ')}` });
}

/** Варианты вопроса на понимание: 3–4 разных, ответ среди них. */
function optionIssues(q: { q: string; options: string[]; answer: number }, w: string, out: Issue[]) {
  const opts = q.options ?? [];
  if (empty(q.q)) out.push({ level: 'error', where: w, msg: 'пустой вопрос' });
  if (opts.length < 3 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) out.push({ level: 'error', where: w, msg: 'нужно 3–4 разных варианта' });
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: w, msg: `ответ ${q.answer}` });
}

/** Слов в тексте загадки мудрости. */
export const SPHINX_TEXT_WORDS = [400, 600] as const;
/** Вопросов на понимание текста. */
export const SPHINX_WISDOM_QUESTIONS = 5;

/**
 * Загадка мудрости: три набора `sx:wisdom.<n>`; заголовок и текст 400–600 слов, у каждого абзаца перевод; 5 вопросов
 * на понимание; два задания `register` плитками — одно в официальный тон, другое в дружеский, проверка как в уроках;
 * незнакомых слов к уровню 7 не больше 7%, каждое в `gloss`.
 */
function wisdomIssues(sets: SphinxFile['wisdom'], checks: SphinxChecks): Issue[] {
  const out: Issue[] = [];
  const where = 'sphinx.json';
  if (sets.length !== SPHINX_SETS) out.push({ level: 'error', where, msg: `загадка мудрости: наборов ${sets.length}, нужно ${SPHINX_SETS}` });
  const sources = new Map<string, string>();
  sets.forEach((set, i) => {
    const id = `sx:wisdom.${i + 1}`;
    const at = `${where} ${set.id ?? id}`;
    const err = (msg: string, w = at) => out.push({ level: 'error', where: w, msg });
    if (set.id !== id) err(`id набора должен быть "${id}"`);
    if (empty(set.title)) err('нет заголовка');
    const text = set.text ?? [];
    if (text.some((p) => empty(p.es) || empty(p.ru))) err('пустой абзац или перевод');
    const words = text.reduce((n, p) => n + (empty(p.es) ? 0 : wordCount(p.es)), 0);
    if (words < SPHINX_TEXT_WORDS[0] || words > SPHINX_TEXT_WORDS[1]) err(`в тексте ${words} слов, нужно ${SPHINX_TEXT_WORDS.join('–')}`);
    const qs = set.questions ?? [];
    if (qs.length !== SPHINX_WISDOM_QUESTIONS) err(`вопросов ${qs.length}, нужно ${SPHINX_WISDOM_QUESTIONS}`);
    qs.forEach((q, k) => optionIssues(q, `${at} вопрос ${k + 1}`, out));
    const reg = set.register ?? [];
    const tones = reg.map((e) => (e.kind === 'register' ? e.to : e.kind)).sort().join(',');
    if (tones !== 'formal,informal') err(`задания тона: ${tones || 'нет'}, нужно одно formal и одно informal`);
    reg.forEach((e, k) => {
      const w = `${at} тон ${k + 1}`;
      if (e.id !== `${id}.${k + 1}`) err(`id задания должен быть "${id}.${k + 1}"`, w);
      if (e.kind !== 'register' || !('extra' in e)) {
        err('нужно задание register с плитками', w);
        return;
      }
      checkExercise(e, w, out);
      const src = normalize(e.source ?? '');
      if (sources.has(src)) err(`фраза уже есть в ${sources.get(src)}`, w);
      sources.set(src, e.id);
    });
    const all = [set.title, ...text.map((p) => p.es)].filter((t) => !empty(t));
    const gloss = glossIssues(all, set.gloss, at, out);
    coverageIssues(all.join(' '), gloss, at, checks, out);
  });
  return out;
}

/**
 * Загадка слуха: три набора `sx:hear.<n>`; монолог 150–260 слов одним голосом; спор двух говорящих с разной высотой
 * голоса, не меньше 8 реплик и по 3 у каждого; вопросы с тремя-четырьмя разными вариантами, состав по `SPHINX_HEAR_MIX`;
 * незнакомых слов к уровню 7 не больше 7%, каждое переведено в `gloss`.
 */
function hearIssues(sets: SphinxFile['hear'], checks: SphinxChecks): Issue[] {
  const out: Issue[] = [];
  const where = 'sphinx.json';
  if (sets.length !== SPHINX_SETS) out.push({ level: 'error', where, msg: `загадка слуха: наборов ${sets.length}, нужно ${SPHINX_SETS}` });
  const voices = checks.voices;
  sets.forEach((set, i) => {
    const id = `sx:hear.${i + 1}`;
    const at = `${where} ${set.id ?? id}`;
    const err = (msg: string, w = at) => out.push({ level: 'error', where: w, msg });
    if (set.id !== id) err(`id набора должен быть "${id}"`);
    const mono = set.monologue?.lines ?? [];
    if (mono.some((l) => empty(l.es) || empty(l.ru))) err('пустая фраза монолога или перевод');
    const words = mono.reduce((n, l) => n + (empty(l.es) ? 0 : wordCount(l.es)), 0);
    if (words < SPHINX_MONOLOGUE_WORDS[0] || words > SPHINX_MONOLOGUE_WORDS[1]) err(`в монологе ${words} слов, нужно ${SPHINX_MONOLOGUE_WORDS.join('–')}`);
    if (voices && !(set.monologue?.who in voices)) err(`говорящий монолога "${set.monologue?.who}" не житель и не Летописец`);
    const disp = set.dispute ?? [];
    if (disp.some((l) => empty(l.es) || empty(l.ru))) err('пустая реплика спора или перевод');
    const speakers = [...new Set(disp.map((l) => l.who))];
    if (speakers.length !== 2) err(`в споре ${speakers.length} говорящих, нужно два`);
    if (disp.length < SPHINX_DISPUTE_LINES) err(`в споре ${disp.length} реплик, нужно не меньше ${SPHINX_DISPUTE_LINES}`);
    for (const who of speakers) {
      if (voices && !(who in voices)) err(`говорящий спора "${who}" не житель`);
      if (disp.filter((l) => l.who === who).length < SPHINX_DISPUTE_EACH) err(`у "${who}" меньше ${SPHINX_DISPUTE_EACH} реплик`);
    }
    if (voices && speakers.length === 2 && voices[speakers[0]] === voices[speakers[1]]) err('у говорящих спора одинаковая высота голоса');
    const mix: Record<string, number> = {};
    (set.questions ?? []).forEach((q, k) => {
      const w = `${at} вопрос ${k + 1}`;
      optionIssues(q, w, out);
      if (!(q.part in SPHINX_HEAR_MIX) || !(q.kind in SPHINX_HEAR_MIX.monologue)) err(`вопрос "${q.part}/${q.kind}"`, w);
      mix[`${q.part}/${q.kind}`] = (mix[`${q.part}/${q.kind}`] ?? 0) + 1;
    });
    for (const [part, kinds] of Object.entries(SPHINX_HEAR_MIX)) {
      for (const [kind, n] of Object.entries(kinds)) {
        if ((mix[`${part}/${kind}`] ?? 0) !== n) err(`вопросов ${part}/${kind}: ${mix[`${part}/${kind}`] ?? 0}, нужно ${n}`);
      }
    }
    const lines = [...mono.map((l) => l.es), ...disp.map((l) => l.es)].filter((t) => !empty(t));
    const gloss = glossIssues(lines, set.gloss, at, out);
    coverageIssues(lines.join(' '), gloss, at, checks, out);
  });
  return out;
}

export const VERBS_MIN = 60;

const VERB_END: Record<Lang, RegExp> = { es: /(ar|er|ir|ír)$/, it: /(are|ere|ire)$/ };

/**
 * Кузница глаголов (задача 5.5): кузнец с репликой и портретом, не меньше 60 разных глаголов с переводом.
 * Записанная строка времени — шесть непустых форм, и она должна отличаться от того, что дал бы генератор окончаний:
 * правильные формы не записываются, генератор и данные не расходятся молча.
 */
/** Мастер без места (кузнец, звонарь): имя, роль, пол, приветствие, голос, облик. */
function checkMaster(s: Smith | undefined, at: string, out: Issue[]) {
  if (!s) {
    out.push({ level: 'error', where: at, msg: 'нет' });
    return;
  }
  for (const f of ['name', 'role'] as const) if (empty(s[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  if (s.gender !== 'm' && s.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${s.gender}"` });
  if (empty(s.greeting?.es) || empty(s.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
  const { pitch, rate } = s.voice ?? {};
  if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
  checkLook(s.look, at, out);
}

/** Слов праздника: не меньше и не больше (два урока слов). */
export const FESTIVAL_WORDS = { min: 10, max: 15 };

/**
 * Праздники (задача 10.5): у каждого праздника языка свой файл; слова с префиксом `fest-<id>.` уровня 1, фразы
 * и одна миссия хозяина — общими проверками фраз и миссий, где праздник — «место» `fest-<id>`.
 */
export function validateFestivals(
  files: { name: string; data: FestivalFile }[],
  lang: Lang,
  checks: { residents: Record<string, string>; phrases: PhraseChecks; missions: Omit<MissionChecks, 'residents' | 'phrases'> },
): Issue[] {
  const out: Issue[] = [];
  const byId = new Map(files.map((f) => [f.data?.id, f]));
  for (const f of festivalsOf(lang)) {
    const file = byId.get(f.id);
    const where = `festivals/${f.id}.json`;
    if (!file) {
      out.push({ level: 'error', where, msg: 'нет файла праздника' });
      continue;
    }
    if (file.name !== `${f.id}.json`) out.push({ level: 'error', where, msg: `имя файла не совпадает с id "${f.id}"` });
    const host = checks.residents[f.host];
    if (!host) out.push({ level: 'error', where, msg: `у здания хозяина "${f.host}" нет жителя` });
    const { data } = file;
    if (empty(data.intro?.es) || empty(data.intro?.ru)) out.push({ level: 'error', where, msg: 'нет приглашения хозяина (intro)' });
    if (empty(data.about)) out.push({ level: 'error', where, msg: 'нет рассказа о празднике (about)' });
    const place = festivalPlace(f.id);
    const words = data.words ?? [];
    if (words.length < FESTIVAL_WORDS.min || words.length > FESTIVAL_WORDS.max) {
      out.push({ level: 'error', where, msg: `${words.length} слов, нужно ${FESTIVAL_WORDS.min}–${FESTIVAL_WORDS.max}` });
    }
    const ids = new Set<string>();
    words.forEach((w, i) => {
      const at = `${where} слово #${i} ${w.id ?? '?'}`;
      checkWord(w, at, lang, out);
      if (!w.id?.startsWith(`${place}.`)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${place}."` });
      if (w.level !== 1) out.push({ level: 'error', where: at, msg: 'у слова праздника level всегда 1' });
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(w.id);
    });
    const tag = (list: Issue[]) => list.map((x) => ({ ...x, where: `festivals/${f.id} ${x.where}` }));
    // Имена собственные праздника (Fermín, Ferragosto) знакомы: в словаре их нет, но учить их не нужно.
    const names = new Set((data.names ?? []).map((n) => normalize(n)));
    const known = (t: string) => !names.has(normalize(t));
    const uncovered = checks.phrases.uncovered;
    const phraseChecks: PhraseChecks = { ...checks.phrases, places: [place], uncovered: uncovered && ((text, level) => uncovered(text, level).filter(known)) };
    out.push(...tag(validatePhrases([{ name: `${place}.json`, data: { location: place as LocationId, phrases: data.phrases ?? [] } }], phraseChecks)));
    const missions = data.missions ?? [];
    if (missions.length !== 1 || missions[0]?.id !== festivalMissionId(f.id)) {
      out.push({ level: 'error', where, msg: `нужна одна миссия "${festivalMissionId(f.id)}"` });
    }
    out.push(
      ...tag(
        validateMissions([{ name: `${place}.json`, data: { location: place as LocationId, missions } }], {
          ...checks.missions,
          coverage:
            checks.missions.coverage &&
            ((text, level) => {
              const c = checks.missions.coverage!(text, level);
              return { total: c.total, unknown: c.unknown.filter(known) };
            }),
          places: [place],
          residents: { [place]: host ?? '' },
          phrases: { [place]: data.phrases ?? [] },
        }),
      ),
    );
  }
  for (const f of files) {
    if (!festivalsOf(lang).some((x) => `${x.id}.json` === f.name)) out.push({ level: 'error', where: `festivals/${f.name}`, msg: 'праздника нет в FESTIVALS этого языка' });
  }
  return out;
}

/** Пар в противопоставлении не меньше: иначе звон из десяти заданий повторяет пары слишком часто. */
export const PAIRS_MIN = 6;

/** Звонница (задача 10.2): звонарь и противопоставления, каждая пара различается ровно тем, что заявлено. */
export function validatePairs(file: PairsFile | undefined): Issue[] {
  const where = 'pairs.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла минимальных пар' }];
  const out: Issue[] = [];
  checkMaster(file.ringer, `${where} звонарь`, out);
  if (!file.contrasts?.length) out.push({ level: 'error', where, msg: 'нет противопоставлений' });
  const ids = new Set<string>();
  for (const c of file.contrasts ?? []) {
    const at = `${where} ${c.id}`;
    if (!/^[a-z-]+$/.test(c.id ?? '') || ids.has(c.id)) out.push({ level: 'error', where: at, msg: 'id пустой, с лишними знаками или повторяется' });
    ids.add(c.id);
    if (empty(c.title) || empty(c.hint)) out.push({ level: 'error', where: at, msg: 'нет названия или подсказки' });
    if (!['swap', 'stress', 'double'].includes(c.kind)) out.push({ level: 'error', where: at, msg: `вид "${c.kind}"` });
    if ((c.pairs?.length ?? 0) < PAIRS_MIN) out.push({ level: 'error', where: at, msg: `пар меньше ${PAIRS_MIN}` });
    const seen = new Set<string>();
    (c.pairs ?? []).forEach((p, i) => {
      const issue = pairIssue(c, p);
      if (issue) out.push({ level: 'error', where: `${at}.${i}`, msg: issue });
      const key = `${p[0]?.es}|${p[1]?.es}`;
      if (seen.has(key)) out.push({ level: 'error', where: `${at}.${i}`, msg: 'пара повторяется' });
      seen.add(key);
    });
  }
  return out;
}

export function validateVerbs(file: VerbsFile | undefined, lang: Lang): Issue[] {
  const out: Issue[] = [];
  const where = 'verbs.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла глаголов' }];
  checkMaster(file.smith, `${where} кузнец`, out);
  const seen = new Set<string>();
  for (const v of file.verbs ?? []) {
    const at = `${where} ${v.inf ?? '?'}`;
    if (seen.has(v.inf)) out.push({ level: 'error', where: at, msg: 'дубль глагола' });
    seen.add(v.inf);
    if (empty(v.inf) || !VERB_END[lang].test(v.inf)) out.push({ level: 'error', where: at, msg: 'инфинитив с неожиданным окончанием' });
    if (empty(v.ru)) out.push({ level: 'error', where: at, msg: 'нет перевода' });
    if (lang === 'es' && (v.isc || v.aux)) out.push({ level: 'error', where: at, msg: 'isc и aux бывают только у итальянских глаголов' });
    if (lang === 'it' && v.ch) out.push({ level: 'error', where: at, msg: 'чередование ch бывает только у испанских глаголов' });
    const bare = { inf: v.inf, ru: v.ru, ch: v.ch, isc: v.isc };
    if (v.pp && v.pp === participle(bare, lang)) out.push({ level: 'error', where: at, msg: 'причастие pp совпадает с правильным, запись не нужна' });
    if (v.yo && v.yo === conjugate(bare, 'presente', lang)[0]) out.push({ level: 'error', where: at, msg: 'форма yo совпадает с правильной, запись не нужна' });
    for (const [t, forms] of Object.entries(v.forms ?? {})) {
      if (!TENSES[lang].includes(t as Tense)) {
        out.push({ level: 'error', where: at, msg: `неизвестное время "${t}"` });
        continue;
      }
      if (!Array.isArray(forms) || forms.length !== 6 || forms.some((f) => empty(f))) {
        out.push({ level: 'error', where: at, msg: `${t}: нужно 6 непустых форм` });
        continue;
      }
      if (generated(v, t as Tense, lang).every((f, i) => f === forms[i])) {
        out.push({ level: 'error', where: at, msg: `${t}: совпадает с правильной формой, запись не нужна` });
      }
    }
  }
  if (seen.size < VERBS_MIN) out.push({ level: 'error', where, msg: `глаголов ${seen.size}, нужно не меньше ${VERBS_MIN}` });
  return out;
}

/**
 * Рисованные портреты: у каждого персонажа с полем `look.portrait` должен быть файл картинки своего языка,
 * а имя — из строчных латинских букв и цифр. exists(имя) — есть ли `src/assets/portraits/<язык>/<имя>.webp`.
 */
export function validatePortraits(looks: { where: string; look?: NpcLook }[], exists: (name: string) => boolean): Issue[] {
  const out: Issue[] = [];
  for (const { where, look } of looks) {
    const p = look?.portrait;
    if (p === undefined) continue;
    if (!/^[a-z0-9]+$/.test(p)) out.push({ level: 'error', where, msg: `имя портрета "${p}": только строчные латинские буквы и цифры` });
    else if (!exists(p)) out.push({ level: 'error', where, msg: `нет картинки портрета ${p}.webp` });
  }
  return out;
}

/** Жители: по одному на каждое место, уникальные id, заполненные поля, голос и портрет в допустимых пределах. */
export function validateNpcs(file: NpcsFile | undefined): Issue[] {
  const out: Issue[] = [];
  const where = 'npcs.json';
  if (!file?.npcs?.length) return [{ level: 'error', where, msg: 'нет жителей' }];
  const ids = new Set<string>();
  const places = new Map<string, string>();
  for (const n of file.npcs) {
    const at = `${where} ${n.id ?? '?'}`;
    checkNpc(n, at, n.location === 'school' ? '{правил}' : '{слов}', out);
    if (ids.has(n.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
    ids.add(n.id);
    if (n.register !== undefined && n.register !== 'formal' && n.register !== 'informal') out.push({ level: 'error', where: at, msg: `тон жителя "${n.register}": formal или informal` });
    if (!(LOCATION_IDS as readonly string[]).includes(n.location)) out.push({ level: 'error', where: at, msg: `неизвестное место "${n.location}"` });
    else if (places.has(n.location)) out.push({ level: 'error', where: at, msg: `в месте ${n.location} уже живёт ${places.get(n.location)}` });
    else places.set(n.location, n.id);
  }
  for (const loc of LOCATION_IDS) if (!places.has(loc)) out.push({ level: 'error', where, msg: `в месте ${loc} нет жителя` });
  return out;
}

/** Летописец: те же проверки, что у жителя, но без места; поручения — слова свитка. */
export function validateChronicler(n: Chronicler | undefined, npcs: NpcsFile | undefined): Issue[] {
  const where = 'chronicler.json';
  if (!n) return [{ level: 'error', where, msg: 'нет Летописца' }];
  const out: Issue[] = [];
  checkNpc(n, where, '{слов}', out);
  if ('location' in n) out.push({ level: 'error', where, msg: 'у Летописца нет места, поле location лишнее' });
  if (npcs?.npcs.some((x) => x.id === n.id)) out.push({ level: 'error', where, msg: `id "${n.id}" уже занят жителем` });
  return out;
}

/**
 * Свитки земель: файл `<глава>.json`, id `scroll<глава>.<slug>`, CEFR главы. Слово свитка не повторяет слово места
 * и другого свитка (ни id, ни форма), число слов не больше плана `vocabPlan.ts`.
 */
/**
 * Одинаковый перевод у слов разных мест и свитков одного языка: в задании «Как сказать» по переводу выходят
 * два верных ответа, а в повторении непонятно, какое слово ждут. Совпадения внутри одного уровня места
 * и внутри одного свитка уже сообщают validateWords и validateScrolls, здесь они пропускаются.
 */
export function validateTranslations(places: { name: string; data: LocationWords }[], scrolls: { name: string; data: ScrollFile }[]): Issue[] {
  const out: Issue[] = [];
  const seen = new Map<string, { id: string; group: string }>();
  const all = [
    ...places.flatMap(({ name, data }) => (data.words ?? []).map((w) => ({ w, where: name, group: `${data.location}:${w.level}` }))),
    ...scrolls.flatMap(({ name, data }) => (data.words ?? []).map((w) => ({ w, where: `scrolls/${name}`, group: `scroll${data.chapter}` }))),
  ];
  for (const { w, where, group } of all) {
    if (empty(w.ru) || empty(w.id)) continue;
    const key = w.ru.trim().toLowerCase();
    const first = seen.get(key);
    if (!first) seen.set(key, { id: w.id, group });
    else if (first.group !== group) out.push({ level: 'warning', where: `${where} ${w.id}`, msg: `тот же перевод «${w.ru}», что у ${first.id}` });
  }
  return out;
}

export function validateScrolls(files: { name: string; data: ScrollFile }[], places: { name: string; data: LocationWords }[], lang: Lang = 'es'): Issue[] {
  const out: Issue[] = [];
  const ids = new Map<string, string>();
  const forms = new Map<string, string>();
  for (const { data } of places) {
    for (const w of data.words ?? []) {
      if (!empty(w.id)) ids.set(w.id, w.id);
      if (!empty(w.es)) forms.set(normalize(w.es), w.id);
    }
  }
  for (const { name, data } of files) {
    const plan = PLAN[data.chapter - 1];
    if (!plan) {
      out.push({ level: 'error', where: name, msg: `неизвестная глава ${data.chapter}` });
      continue;
    }
    if (`${data.chapter}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с главой ${data.chapter}` });
    if (!Array.isArray(data.words) || !data.words.length) {
      out.push({ level: 'error', where: name, msg: 'нет слов' });
      continue;
    }
    if (data.words.length > plan.scroll) out.push({ level: 'error', where: name, msg: `${data.words.length} слов, по плану не больше ${plan.scroll}` });
    const prefix = `scroll${data.chapter}.`;
    // Свиток — один урок-пул: одинаковый перевод делает варианты ответа и «пары» неоднозначными.
    const ruSeen = new Map<string, string>();
    data.words.forEach((w, i) => {
      const at = `scrolls/${name}#${i} ${w.id ?? '?'}`;
      checkWord(w, at, lang, out);
      if (empty(w.id) || empty(w.es)) return;
      if (!w.id.startsWith(prefix)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${prefix}"` });
      if (w.level !== 1) out.push({ level: 'error', where: at, msg: 'у слова свитка level всегда 1' });
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.set(w.id, w.id);
      const key = normalize(w.es);
      if (forms.has(key)) out.push({ level: 'error', where: at, msg: `"${w.es}" уже есть: ${forms.get(key)}` });
      forms.set(key, w.id);
      if (!empty(w.ru)) {
        const rk = w.ru.trim().toLowerCase();
        if (ruSeen.has(rk)) out.push({ level: 'warning', where: at, msg: `тот же перевод «${w.ru}», что у ${ruSeen.get(rk)}` });
        else ruSeen.set(rk, w.id);
      }
    });
  }
  return out;
}

export interface PhraseChecks {
  /** Места кроме мест города: праздники (`fest-<id>`). */
  places?: readonly string[];
  /** id уроков грамматики языка: поле grammar должно ссылаться на существующий урок. */
  lessons?: ReadonlySet<string>;
  /** Слова фразы, которых нет в словаре мест того же или более низкого уровня и в грамматике. */
  uncovered?: (text: string, level: number) => string[];
}

/**
 * Фразы мест: `phrases/<место>.json`. id `ph:<место>.<slug>` уникален, форма фразы (с любым набором необязательных
 * слов) не повторяется в курсе, не длиннее 12 слов, скобки размечены верно, уровень 1–7, урок грамматики существует.
 * Слова, не покрытые словарём, — предупреждение: фразу можно сказать, только зная её слова.
 */
export function validatePhrases(files: { name: string; data: LocationPhrases }[], checks: PhraseChecks = {}): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  const forms = new Map<string, string>();
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location) && !checks.places?.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.phrases) || !data.phrases.length) {
      out.push({ level: 'error', where: name, msg: 'нет фраз' });
      continue;
    }
    const prefix = `${PHRASE_PREFIX}${data.location}.`;
    const ruSeen = new Map<string, string>();
    data.phrases.forEach((p, i) => {
      const at = `phrases/${name}#${i} ${p.id ?? '?'}`;
      for (const f of ['id', 'es', 'ru'] as const) if (empty(p[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
      if (!Number.isInteger(p.level) || !(p.level in PLACE_LEVEL_MAX)) out.push({ level: 'error', where: at, msg: `уровень ${p.level}` });
      if (p.register !== undefined && !REGISTERS.includes(p.register)) out.push({ level: 'error', where: at, msg: `регистр "${p.register}"` });
      if (p.note !== undefined && empty(p.note)) out.push({ level: 'error', where: at, msg: 'пустое пояснение note' });
      if (p.grammar !== undefined && checks.lessons && !checks.lessons.has(p.grammar)) {
        out.push({ level: 'error', where: at, msg: `нет урока грамматики "${p.grammar}"` });
      }
      if (empty(p.id) || empty(p.es)) return;
      if (!p.id.startsWith(prefix)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${prefix}"` });
      if (ids.has(p.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(p.id);

      for (const [text, what] of [[p.es, 'es'], ...(p.alt ?? []).map((a) => [a, 'alt'] as const)] as const) {
        if (empty(text)) {
          out.push({ level: 'error', where: at, msg: `пустой ${what}` });
          continue;
        }
        if (text !== text.trim() || /\s{2,}/.test(text)) out.push({ level: 'error', where: at, msg: `лишние пробелы в ${what}` });
        const bad = optionalError(text);
        if (bad) {
          out.push({ level: 'error', where: at, msg: `${what}: ${bad}` });
          continue;
        }
        const n = phraseWords(text);
        if (n > PHRASE_MAX_WORDS) out.push({ level: 'error', where: at, msg: `${what}: ${n} слов, не больше ${PHRASE_MAX_WORDS}` });
        // Любой вариант фразы узнаётся ответом: одинаковые варианты у двух фраз путают проверку.
        for (const v of expandOptional(text)) {
          const key = normalize(v);
          const other = forms.get(key);
          if (other && other !== p.id) out.push({ level: 'error', where: at, msg: `вариант «${v}» уже есть у ${other}` });
          else forms.set(key, p.id);
        }
        const miss = checks.uncovered?.(fullPhrase(text), p.level) ?? [];
        if (miss.length) out.push({ level: 'warning', where: at, msg: `${what}: нет в словаре уровня ${p.level} и ниже: ${miss.join(', ')}` });
      }
      if (!empty(p.ru)) {
        const rk = `${p.level}:${p.ru.trim().toLowerCase()}`;
        if (ruSeen.has(rk)) out.push({ level: 'warning', where: at, msg: `тот же перевод «${p.ru}», что у ${ruSeen.get(rk)}` });
        else ruSeen.set(rk, p.id);
      }
    });
  }
  return out;
}

/** Доля незнакомых слов в сцене, выше которой сцена не проходит проверку. */
export const SCENE_UNKNOWN_MAX = 0.07;

/** Шёпоты — подслушанные разговоры Леса шёпотов (глава IV). */
export const OVERHEAR_CHAPTER = 4;
/** Шёпот короче этого — не разговор, а обмен репликами. */
export const OVERHEAR_MIN_LINES = 6;
export const OVERHEAR_MIN_QUESTIONS = 3;

export interface SceneChecks {
  /** Место → id его жителя. */
  residents: Record<string, string>;
  /** id жителя → высота голоса: в шёпоте два голоса должны различаться на слух. */
  pitch?: Record<string, number>;
  /** Слова реплик: всего и незнакомые к уровню главы (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
}

export interface SceneReport {
  scenes: number;
  /** Из них шёпотов. */
  whispers: number;
  words: number;
  unknown: number;
}

/**
 * Сцены мест: `scenes/<место>.json`. id `sc:<место>.<глава>`, житель — житель этого места, реплики героя и жителей,
 * вопросы на понимание. Незнакомых слов (не из словаря мест уровней главы и ниже и не из грамматики) не больше 7%,
 * каждое такое слово переведено в `gloss`, иначе нажатие на него ничего не покажет.
 */
export function validateScenes(files: { name: string; data: LocationScenes }[], checks: SceneChecks): { issues: Issue[]; report: SceneReport } {
  const out: Issue[] = [];
  const report: SceneReport = { scenes: 0, whispers: 0, words: 0, unknown: 0 };
  const ids = new Set<string>();
  const npcIds = new Set(Object.values(checks.residents));
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.scenes) || !data.scenes.length) {
      out.push({ level: 'error', where: name, msg: 'нет сцен' });
      continue;
    }
    for (const sc of data.scenes) {
      const at = `scenes/${name} ${sc.id ?? '?'}`;
      report.scenes++;
      const overhear = sc.mode === 'overhear';
      if (overhear) report.whispers++;
      if (sc.mode !== undefined && !overhear) out.push({ level: 'error', where: at, msg: `вид сцены "${sc.mode}"` });
      const prefix = overhear ? 'wh' : 'sc';
      if (sc.id !== `${prefix}:${data.location}.${sc.chapter}`) out.push({ level: 'error', where: at, msg: `id должен быть "${prefix}:${data.location}.${sc.chapter}"` });
      if (ids.has(sc.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(sc.id);
      const plan = PLAN[sc.chapter - 1];
      if (!plan) out.push({ level: 'error', where: at, msg: `глава ${sc.chapter}` });
      if (sc.npc !== checks.residents[data.location]) out.push({ level: 'error', where: at, msg: `житель "${sc.npc}", в этом месте живёт "${checks.residents[data.location]}"` });
      out.push(...sceneBodyIssues(sc, at, npcIds, checks, report));
      if (overhear) out.push(...overhearIssues(sc, at, checks.residents[data.location], npcIds, checks.pitch));
    }
  }
  return { issues: out, report };
}

/**
 * Общее у сцен мест и нити глав: реплики, вопросы на понимание, `gloss` и доля незнакомых слов к уровню главы
 * (слова считаются в `report`).
 */
function sceneBodyIssues(sc: Scene, at: string, npcIds: ReadonlySet<string>, checks: Pick<SceneChecks, 'coverage'>, report: SceneReport): Issue[] {
  const out: Issue[] = [];
  const overhear = sc.mode === 'overhear';
  const plan = PLAN[sc.chapter - 1];
  const lines = sc.lines ?? [];
  if (lines.length < 2) out.push({ level: 'error', where: at, msg: 'меньше двух реплик' });
  if (!lines.some((l) => l.who === 'npc')) out.push({ level: 'error', where: at, msg: 'житель не говорит ни одной реплики' });
  lines.forEach((l, i) => {
    if (l.who !== 'npc' && l.who !== 'hero' && !npcIds.has(l.who)) out.push({ level: 'error', where: `${at} #${i}`, msg: `кто говорит: "${l.who}"` });
    if (empty(l.es) || empty(l.ru)) out.push({ level: 'error', where: `${at} #${i}`, msg: 'пустая реплика или перевод' });
  });
  const qs = sc.questions ?? [];
  if (!qs.length) out.push({ level: 'error', where: at, msg: 'нет вопросов на понимание' });
  qs.forEach((q, i) => {
    const opts = q.options ?? [];
    if (empty(q.q)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'пустой вопрос' });
    if (opts.length < 2 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) {
      out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'нужно 2–4 разных варианта' });
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `ответ ${q.answer}` });
    if (q.kind !== undefined && (q.kind !== 'stance' || !overhear)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `вид вопроса "${q.kind}" бывает только у шёпота` });
    if (overhear && q.kind !== 'stance') out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'в шёпоте вопросы вида stance' });
  });
  const text = lines.map((l) => l.es).join(' ');
  // Слова реплик так же, как их нажимают на экране сцены: «dell'Elisir» — это «dell'» и «elisir».
  // Женские формы реплик (`fem`) тоже нажимаются: их слова в gloss не лишние.
  const keys = new Set(lines.flatMap((l) => [l.es ?? '', l.fem?.es ?? ''].flatMap((t) => sceneWords(t).flatMap((p) => ('key' in p ? [normalize(p.key)] : [])))));
  const gloss = Object.fromEntries(Object.entries(sc.gloss ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  for (const [k, v] of Object.entries(gloss)) {
    if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
    if (!keys.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в репликах` });
  }
  if (plan && checks.coverage) {
    const level = Math.max(...plan.levels);
    const cov = checks.coverage(text, level);
    report.words += cov.total;
    report.unknown += cov.unknown.length;
    const share = cov.total ? cov.unknown.length / cov.total : 0;
    if (share > SCENE_UNKNOWN_MAX) {
      out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${Math.round(SCENE_UNKNOWN_MAX * 100)}%` });
    }
    const bare = [...new Set(cov.unknown)].filter((t) => !gloss[t]);
    if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
  }
  return out;
}

export interface ThreadChecks extends Pick<SceneChecks, 'coverage'> {
  /** id Летописца: он ведёт нить. */
  chronicler: string;
  /** id жителей: они могут вставить реплику в сцену нити. */
  residents: string[];
  /** Главы, у которых нить уже написана: у каждой ровно три сцены. */
  chapters: number[];
  /** Записок у такой главы не меньше. */
  notesMin: number;
}

/**
 * Нить глав (задача 13.1): `scenes/thread.json`. Сцены Летописца `th:<глава>.<trigger>`, по одной на момент
 * (`open`, `half`, `climax`) у каждой главы из `chapters`, и записки конца дня по главам. Реплики, вопросы и доля
 * незнакомых слов проверяются как у сцен мест.
 */
export function validateThread(file: { name: string; data: ThreadFile } | undefined, checks: ThreadChecks): { issues: Issue[]; report: SceneReport } {
  const out: Issue[] = [];
  const report: SceneReport = { scenes: 0, whispers: 0, words: 0, unknown: 0 };
  if (!file) {
    if (checks.chapters.length) out.push({ level: 'error', where: 'scenes/thread.json', msg: 'нет нити глав' });
    return { issues: out, report };
  }
  const { name, data } = file;
  const where = `scenes/${name}`;
  if (data.location !== 'thread') out.push({ level: 'error', where, msg: 'location должен быть "thread"' });
  const npcIds = new Set(checks.residents);
  const ids = new Set<string>();
  for (const sc of data.scenes ?? []) {
    const at = `${where} ${sc.id ?? '?'}`;
    report.scenes++;
    if (!sc.trigger || !THREAD_TRIGGERS.includes(sc.trigger)) out.push({ level: 'error', where: at, msg: `момент нити "${sc.trigger}"` });
    else if (sc.id !== threadId(sc.chapter, sc.trigger)) out.push({ level: 'error', where: at, msg: `id должен быть "${threadId(sc.chapter, sc.trigger)}"` });
    if (sc.mode !== undefined) out.push({ level: 'error', where: at, msg: 'сцена нити — не шёпот' });
    if (!PLAN[sc.chapter - 1]) out.push({ level: 'error', where: at, msg: `глава ${sc.chapter}` });
    if (ids.has(sc.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
    ids.add(sc.id);
    if (sc.npc !== checks.chronicler) out.push({ level: 'error', where: at, msg: `нить ведёт Летописец "${checks.chronicler}", а не "${sc.npc}"` });
    out.push(...sceneBodyIssues(sc, at, npcIds, checks, report));
  }
  for (const ch of checks.chapters) {
    for (const t of THREAD_TRIGGERS) if (!ids.has(threadId(ch, t))) out.push({ level: 'error', where, msg: `у главы ${ch} нет сцены нити ${threadId(ch, t)}` });
    const notes = data.notes?.[String(ch)] ?? [];
    if (notes.length < checks.notesMin) out.push({ level: 'error', where, msg: `у главы ${ch} записок ${notes.length}, нужно не меньше ${checks.notesMin}` });
  }
  for (const [ch, notes] of Object.entries(data.notes ?? {})) {
    const plan = PLAN[Number(ch) - 1];
    if (!plan) out.push({ level: 'error', where, msg: `записки главы ${ch}` });
    notes.forEach((n, i) => {
      const at = `${where} записка ${ch}.${i + 1}`;
      if (empty(n.es) || empty(n.ru)) out.push({ level: 'error', where: at, msg: 'пустая записка или перевод' });
      else if (plan && checks.coverage) {
        // У записки нет перевода по нажатию: слова не из словаря главы переведены в её `gloss` и видны под ней.
        const level = Math.max(...plan.levels);
        const gloss = new Set(Object.keys(n.gloss ?? {}).map((k) => k.toLowerCase()));
        const bare = [...new Set(checks.coverage(n.es, level).unknown)].filter((t) => !gloss.has(t));
        if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
        const words = new Set(sceneWords(n.es).flatMap((p) => ('key' in p ? [normalize(p.key)] : [])));
        for (const [k, v] of Object.entries(n.gloss ?? {})) {
          if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
          if (!words.has(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в записке` });
        }
      }
    });
  }
  return { issues: out, report };
}

/**
 * Шёпот: глава IV, герой молчит, говорят двое — житель места (`npc`) и ещё один житель, оба не меньше двух раз,
 * голоса разной высоты. Реплик не меньше шести, вопросов о подразумеваемом не меньше трёх.
 */
function overhearIssues(sc: Scene, at: string, resident: string | undefined, npcIds: ReadonlySet<string>, pitch?: Record<string, number>): Issue[] {
  const out: Issue[] = [];
  const lines = sc.lines ?? [];
  if (sc.chapter !== OVERHEAR_CHAPTER) out.push({ level: 'error', where: at, msg: `шёпоты бывают в главе ${OVERHEAR_CHAPTER}` });
  if (lines.length < OVERHEAR_MIN_LINES) out.push({ level: 'error', where: at, msg: `в шёпоте меньше ${OVERHEAR_MIN_LINES} реплик` });
  if ((sc.questions ?? []).length < OVERHEAR_MIN_QUESTIONS) out.push({ level: 'error', where: at, msg: `в шёпоте меньше ${OVERHEAR_MIN_QUESTIONS} вопросов` });
  if (lines.some((l) => l.who === 'hero')) out.push({ level: 'error', where: at, msg: 'в шёпоте герой только слушает' });
  const others = [...new Set(lines.map((l) => l.who).filter((w) => w !== 'npc' && w !== 'hero'))];
  if (others.length !== 1 || others[0] === resident) {
    out.push({ level: 'error', where: at, msg: 'в шёпоте говорят двое: житель места ("npc") и другой житель' });
    return out;
  }
  const other = others[0];
  for (const who of ['npc', other]) {
    if (lines.filter((l) => l.who === who).length < 2) out.push({ level: 'error', where: at, msg: `"${who}" говорит меньше двух реплик` });
  }
  if (pitch && resident && npcIds.has(other) && pitch[resident] === pitch[other]) {
    out.push({ level: 'error', where: at, msg: `у "${resident}" и "${other}" одинаковая высота голоса ${pitch[other]}` });
  }
  return out;
}

/** Меньше стольких ответов героя 80% означало бы «без единой ошибки». */
export const MISSION_MIN_ANSWERS = 5;

export interface MissionChecks {
  residents: Record<string, string>;
  /** Места кроме мест города: праздники (`fest-<id>`). */
  places?: readonly string[];
  /** Фразы мест: ответы героя — только фразы своего места. */
  phrases: Record<string, Phrase[]>;
  /** id существующих сцен. */
  scenes: ReadonlySet<string>;
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
  /** Тон жителей мест (`npcs.json`, поле register): узел тона у такого жителя требует его тона. */
  registers?: Record<string, 'formal' | 'informal' | undefined>;
}

/**
 * Узел тона: регистр из списка и тот же, что у жителя с постоянным тоном; реакция на чужой тон; ветки — фразы
 * с регистром, первая в нужном тоне (по ней плитки), и хотя бы одна в другом, иначе выбирать нечего.
 */
function toneIssues(n: MissionAnswer, own: Map<string, Phrase>, npcTone: 'formal' | 'informal' | undefined): string[] {
  const out: string[] = [];
  if (!REGISTERS.includes(n.register!)) return [`регистр узла "${n.register}"`];
  if (npcTone && n.register !== npcTone) out.push(`житель говорит только ${npcTone === 'formal' ? 'официально' : 'по-свойски'}, а узел ждёт "${n.register}"`);
  if (empty(n.tone?.es) || empty(n.tone?.ru)) out.push('нет реакции жителя на чужой тон (tone)');
  if (isDispute(n)) out.push('узел тона не может быть спором');
  const regs = n.branches.map((b) => own.get(b.phrase)?.register);
  if (regs.some((r) => !r)) out.push('у фраз узла тона должен быть register');
  if (regs[0] && regs[0] !== n.register) out.push('первая ветка узла тона должна быть в нужном тоне');
  if (!regs.some((r) => r && r !== n.register && r !== 'neutral')) out.push('в узле тона нет фразы в другом тоне');
  return out;
}

/**
 * Миссии мест: `missions/<место>.json`. id `ms:<место>.<глава>`, житель места, сцена-вступление той же главы,
 * граф без обрывов и циклов, ответы героя — фразы своего места уровней главы, у каждого ответа реакция на ошибку,
 * не меньше пяти ответов на пути. Реплики жителя (с реакциями) — не больше 7% незнакомых слов. С главы IV в миссии
 * есть спор: ответ с тремя ветками `move` (возразить, уступить, компромисс), у каждой своя реакция.
 */
export function validateMissions(files: { name: string; data: LocationMissions }[], checks: MissionChecks): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location) && !checks.places?.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.missions) || !data.missions.length) {
      out.push({ level: 'error', where: name, msg: 'нет миссий' });
      continue;
    }
    const own = new Map((checks.phrases[data.location] ?? []).map((p) => [p.id, p]));
    for (const m of data.missions) {
      const at = `missions/${name} ${m.id ?? '?'}`;
      if (m.id !== `ms:${data.location}.${m.chapter}`) out.push({ level: 'error', where: at, msg: `id должен быть "ms:${data.location}.${m.chapter}"` });
      if (ids.has(m.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(m.id);
      const plan = PLAN[m.chapter - 1];
      if (!plan) {
        out.push({ level: 'error', where: at, msg: `глава ${m.chapter}` });
        continue;
      }
      const maxLevel = Math.max(...plan.levels);
      if (m.npc !== checks.residents[data.location]) out.push({ level: 'error', where: at, msg: `житель "${m.npc}", в этом месте живёт "${checks.residents[data.location]}"` });
      if (m.scene !== undefined && (m.scene !== `sc:${data.location}.${m.chapter}` || !checks.scenes.has(m.scene))) {
        out.push({ level: 'error', where: at, msg: `нет сцены "${m.scene}" этого места и главы` });
      }
      for (const msg of missionGraphIssues(m)) out.push({ level: 'error', where: at, msg });
      // Спор (возразить, уступить, компромисс) — с главы IV, и там он обязателен.
      const disputes = Object.values(m.nodes ?? {}).filter((n) => n.kind === 'answer' && isDispute(n)).length;
      if (m.chapter >= DISPUTE_FROM_CHAPTER && !disputes) out.push({ level: 'error', where: at, msg: `в миссии главы ${m.chapter} нет спора (ветки с move)` });
      if (m.chapter < DISPUTE_FROM_CHAPTER && disputes) out.push({ level: 'error', where: at, msg: `спор бывает с главы ${DISPUTE_FROM_CHAPTER}` });
      // Узел тона (официально или по-свойски) — с главы V, и там он обязателен.
      const tones = Object.values(m.nodes ?? {}).filter((n) => n.kind === 'answer' && isRegisterNode(n)).length;
      if (m.chapter >= REGISTER_FROM_CHAPTER && !tones) out.push({ level: 'error', where: at, msg: `в миссии главы ${m.chapter} нет узла тона (register)` });
      if (m.chapter < REGISTER_FROM_CHAPTER && tones) out.push({ level: 'error', where: at, msg: `узел тона бывает с главы ${REGISTER_FROM_CHAPTER}` });
      const lines: string[] = [];
      for (const [id, n] of Object.entries(m.nodes ?? {})) {
        const where = `${at} ${id}`;
        if (n.kind === 'say') {
          if (empty(n.es) || empty(n.ru)) out.push({ level: 'error', where, msg: 'пустая реплика или перевод' });
          lines.push(n.es);
        } else if (n.kind === 'answer') {
          if (empty(n.task)) out.push({ level: 'error', where, msg: 'нет задачи героя (task)' });
          if (empty(n.wrong?.es) || empty(n.wrong?.ru)) out.push({ level: 'error', where, msg: 'нет реакции жителя на ошибку' });
          else lines.push(n.wrong.es);
          for (const b of n.branches ?? []) {
            const p = own.get(b.phrase);
            if (!p) out.push({ level: 'error', where, msg: `нет фразы "${b.phrase}" в фразах места` });
            else if (p.level > maxLevel) out.push({ level: 'error', where, msg: `фраза "${b.phrase}" уровня ${p.level}, в главе ${plan.chapter} — до ${maxLevel}` });
          }
          if (isRegisterNode(n)) out.push(...toneIssues(n, own, checks.registers?.[data.location]).map((msg) => ({ level: 'error' as const, where, msg })));
        } else {
          out.push({ level: 'error', where, msg: 'узел должен быть say или answer' });
        }
      }
      if (!missionGraphIssues(m).length && answersOnPath(m) < MISSION_MIN_ANSWERS) {
        out.push({ level: 'error', where: at, msg: `ответов героя ${answersOnPath(m)}, нужно не меньше ${MISSION_MIN_ANSWERS}` });
      }
      if (checks.coverage && lines.length) {
        const cov = checks.coverage(lines.join(' '), maxLevel);
        const share = cov.total ? cov.unknown.length / cov.total : 0;
        if (share > SCENE_UNKNOWN_MAX) {
          out.push({ level: 'error', where: at, msg: `незнакомых слов ${Math.round(share * 100)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${Math.round(SCENE_UNKNOWN_MAX * 100)}%` });
        }
      }
    }
  }
  return out;
}

/**
 * Пролог (задача 13.2): три слова курса, у ответа жителя три варианта — эти слова, верный один; Привратник с голосом.
 * Слова реплик, которых нет в словаре первого уровня, — в `gloss` (`uncovered` считает по словарю курса).
 */
export function validatePrologue(
  data: PrologueFile | undefined,
  checks: { words: Map<string, { es: string }>; uncovered?: (text: string) => string[] },
): Issue[] {
  const where = 'prologue.json';
  if (!data) return [{ level: 'error', where, msg: 'нет пролога' }];
  const out: Issue[] = [];
  const err = (msg: string, at = where) => out.push({ level: 'error', where: at, msg });
  const g = data.gatekeeper;
  if (empty(g?.name) || empty(g?.role) || !g?.voice?.pitch || !g?.voice?.rate) err('у Привратника нет имени, роли или голоса');
  if (data.words?.length !== 3) err(`слов ${data.words?.length ?? 0}, нужно 3`);
  const plain = (s: string) => normalize(s);
  const forms = new Set<string>();
  for (const id of data.words ?? []) {
    const w = checks.words.get(id);
    if (!w) err(`нет слова ${id}`);
    else forms.add(plain(w.es));
  }
  const lines = [...(data.gate ?? []), ...(data.road ?? []), ...(data.finale ?? [])];
  for (const [i, l] of lines.entries()) {
    if (empty(l.es) || empty(l.ru)) err('пустая реплика', `${where}#${i}`);
    if (!['gatekeeper', 'resident', 'hero'].includes(l.who)) err(`кто говорит: ${l.who}`, `${where}#${i}`);
  }
  if (data.mission?.length !== 3) err(`ответов жителю ${data.mission?.length ?? 0}, нужно 3`);
  for (const [i, a] of (data.mission ?? []).entries()) {
    const at = `${where} ответ ${i + 1}`;
    if (empty(a.say?.es) || empty(a.say?.ru) || empty(a.wrong?.es) || empty(a.wrong?.ru)) err('пустая реплика жителя', at);
    if (a.options?.length !== 3 || a.answer < 0 || a.answer >= (a.options?.length ?? 0)) err('нужно три варианта и номер верного', at);
    for (const o of a.options ?? []) if (!forms.has(plain(o))) err(`вариант «${o}» — не слово пролога`, at);
    if (new Set((a.options ?? []).map(plain)).size !== (a.options?.length ?? 0)) err('одинаковые варианты', at);
  }
  const answers = new Set((data.mission ?? []).map((a) => plain(a.options?.[a.answer] ?? '')));
  if (answers.size !== 3) err('каждое слово пролога должно быть верным ответом один раз');
  if (checks.uncovered) {
    const gloss = new Set(Object.keys(data.gloss ?? {}).map((k) => k.toLowerCase()));
    const texts = [...lines.map((l) => l.es), ...(data.mission ?? []).flatMap((a) => [a.say.es, a.wrong.es])];
    const miss = [...new Set(texts.flatMap((t) => checks.uncovered!(t)))].filter((t) => !gloss.has(t));
    if (miss.length) out.push({ level: 'error', where, msg: `нет в словаре первого уровня и в gloss: ${miss.join(', ')}` });
  }
  return out;
}

export interface BookChecks {
  /** Слова текста: всего и незнакомые к уровню главы (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
  /** Главы, у которых книги уже написаны: у каждой все четыре текста. */
  chapters: number[];
}

/**
 * Книги Летописца (задача 12.4): `books/<глава>.json`. Четыре текста `book:<глава>.<n>` объёмом по главе
 * (`BOOK_WORDS`), пять вопросов на понимание, незнакомых слов не больше 3%. Каждое незнакомое слово — в словарике
 * книг (`words`, его `forms`) или в `gloss`. Слово словарика — `bk:<глава>.<slug>` уровня главы с примером.
 */
export function validateBooks(files: { name: string; data: BookFile }[], checks: BookChecks): Issue[] {
  const out: Issue[] = [];
  const seenChapters = new Set<number>();
  for (const { name, data } of files) {
    const where = `books/${name}`;
    const ch = data.chapter;
    const plan = PLAN[ch - 1];
    if (`${ch}.json` !== name || !plan) {
      out.push({ level: 'error', where, msg: `глава ${ch} не совпадает с именем файла` });
      continue;
    }
    seenChapters.add(ch);
    const level = Math.max(...plan.levels);
    const [minWords, maxWords] = BOOK_WORDS[ch] ?? [0, Infinity];
    const keysOf = (text: string) => sceneWords(text).flatMap((p) => ('key' in p ? [normalize(p.key)] : []));
    // Словарик главы: формы слов в текстах.
    const forms = new Map<string, string>();
    const ids = new Set<string>();
    for (const w of data.words ?? []) {
      const at = `${where} ${w.id ?? '?'}`;
      if (!w.id?.startsWith(`${BOOK_WORD_PREFIX}${ch}.`)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${BOOK_WORD_PREFIX}${ch}."` });
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(w.id);
      if (empty(w.es) || empty(w.ru)) out.push({ level: 'error', where: at, msg: 'пустое слово или перевод' });
      if (w.level !== level) out.push({ level: 'error', where: at, msg: `уровень ${w.level}, у главы ${ch} — ${level}` });
      if (w.cefr !== plan.cefr) out.push({ level: 'error', where: at, msg: `CEFR ${w.cefr}, у главы — ${plan.cefr}` });
      if (w.pos === 'noun' && !w.gender) out.push({ level: 'error', where: at, msg: 'у существительного нет рода' });
      if (empty(w.example?.es) || empty(w.example?.ru)) out.push({ level: 'error', where: at, msg: 'нет примера' });
      if (!w.forms?.length) out.push({ level: 'error', where: at, msg: 'нет форм в текстах (forms)' });
      for (const f of w.forms ?? []) forms.set(normalize(f), w.id);
    }
    const textKeys = new Set<string>();
    const bookIds = new Set<string>();
    for (const b of data.books ?? []) {
      const at = `${where} ${b.id ?? '?'}`;
      const n = parseBookId(b.id ?? '');
      if (!n || n.chapter !== ch || n.n < 1 || n.n > BOOKS_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `id должен быть "book:${ch}.<1–${BOOKS_PER_CHAPTER}>"` });
      if (bookIds.has(b.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      bookIds.add(b.id);
      if (empty(b.title?.es) || empty(b.title?.ru)) out.push({ level: 'error', where: at, msg: 'нет заголовка или его перевода' });
      const paras = b.paragraphs ?? [];
      if (!paras.length || paras.some((p) => empty(p.es) || empty(p.ru))) out.push({ level: 'error', where: at, msg: 'пустой абзац или перевод' });
      const text = paras.map((p) => p.es).join(' ');
      const count = textWords(text);
      if (count < minWords || count > maxWords) out.push({ level: 'error', where: at, msg: `${count} слов, в главе ${ch} нужно ${minWords}–${maxWords}` });
      const keys = new Set(keysOf(`${b.title?.es ?? ''} ${text}`));
      for (const k of keys) textKeys.add(k);
      const qs = b.questions ?? [];
      if (qs.length !== BOOK_QUESTIONS) out.push({ level: 'error', where: at, msg: `вопросов ${qs.length}, нужно ${BOOK_QUESTIONS}` });
      qs.forEach((q, i) => {
        const opts = q.options ?? [];
        if (empty(q.q)) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'пустой вопрос' });
        if (opts.length < 2 || opts.length > 4 || opts.some(empty) || new Set(opts).size !== opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: 'нужно 2–4 разных варианта' });
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ level: 'error', where: `${at} вопрос ${i + 1}`, msg: `ответ ${q.answer}` });
      });
      const gloss = new Map(Object.entries(b.gloss ?? {}).map(([k, v]) => [normalize(k), v]));
      for (const [k, v] of gloss) {
        if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
        if (!keys.has(k)) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в тексте` });
      }
      if (checks.coverage) {
        const cov = checks.coverage(`${b.title?.es ?? ''} ${text}`, level);
        const share = cov.total ? cov.unknown.length / cov.total : 0;
        if (share > BOOK_UNKNOWN_MAX) {
          out.push({ level: 'error', where: at, msg: `незнакомых слов ${(share * 100).toFixed(1)}% (${[...new Set(cov.unknown)].join(', ')}), не больше ${BOOK_UNKNOWN_MAX * 100}%` });
        }
        const bare = [...new Set(cov.unknown)].filter((t) => !gloss.has(normalize(t)) && !forms.has(normalize(t)));
        if (bare.length) out.push({ level: 'warning', where: at, msg: `нет в словаре уровня ${level}, в словарике книг и в gloss: ${bare.join(', ')}` });
      }
    }
    for (const [f, id] of forms) if (!textKeys.has(f)) out.push({ level: 'warning', where: `${where} ${id}`, msg: `формы "${f}" нет в текстах главы` });
    if (checks.chapters.includes(ch)) {
      for (let n = 1; n <= BOOKS_PER_CHAPTER; n++) if (!bookIds.has(bookId(ch, n))) out.push({ level: 'error', where, msg: `нет текста ${bookId(ch, n)}` });
    }
  }
  for (const ch of checks.chapters) if (!seenChapters.has(ch)) out.push({ level: 'error', where: `books/${ch}.json`, msg: `нет книг главы ${ch}` });
  return out;
}

/**
 * Выбор с последствиями (задача 13.6): развилки миссий и реплики с условием. В развилке каждая ветка ставит один и тот же
 * флаг, у каждой своё значение. Условия — только в обычных сценах и репликах миссий (не в шёпотах и нити глав),
 * группа реплик с условием закрывает все значения флага (`conditionIssues`). Флаг без последствий — предупреждение.
 */
/** Главы с развилками и их наименьшее число (задача 13.6). */
export const STORY_FORKS = { chapters: [1, 2, 3, 4], min: 2 };

export function validateStory(
  scenes: { name: string; data: LocationScenes }[],
  missions: { name: string; data: LocationMissions }[],
  thread?: { name: string; data: ThreadFile },
  forks?: { chapters: number[]; min: number },
): Issue[] {
  const out: Issue[] = [];
  const all = missions.flatMap((f) => f.data.missions ?? []);
  const flags = storyFlags(all);
  // Развилок в главе не меньше `min`: у каждой главы, кроме последней, свои последствия в следующей.
  for (const ch of forks?.chapters ?? []) {
    const n = [...flags.values()].filter((f) => f.chapter === ch).length;
    if (n < forks!.min) out.push({ level: 'error', where: 'missions', msg: `в главе ${ch} развилок ${n}, нужно не меньше ${forks!.min}` });
  }
  const used = new Set<string>();
  for (const f of missions) {
    for (const m of f.data.missions ?? []) {
      const at = `missions/${f.name} ${m.id}`;
      for (const [id, n] of Object.entries(m.nodes ?? {})) {
        if (n.kind !== 'answer' || !n.branches.some((b) => b.sets)) continue;
        const keys = n.branches.map((b) => Object.keys(b.sets ?? {}).sort().join(','));
        if (new Set(keys).size !== 1) out.push({ level: 'error', where: `${at} ${id}`, msg: 'развилка: каждая ветка ставит те же флаги' });
        for (const k of Object.keys(n.branches[0].sets ?? {})) {
          const vals = n.branches.map((b) => b.sets?.[k]);
          if (new Set(vals).size !== vals.length) out.push({ level: 'error', where: `${at} ${id}`, msg: `развилка: у веток одинаковое значение флага "${k}"` });
        }
      }
      for (const chain of missionSayChains(m)) {
        const groups = conditionGroups(chain);
        groups.forEach((g) => used.add(g[0].flag));
        for (const msg of conditionIssues(groups, flags, m.chapter)) out.push({ level: 'error', where: at, msg });
      }
    }
  }
  const sceneFiles = [...scenes.map((f) => ({ ...f, dir: 'scenes' })), ...(thread ? [{ ...thread, dir: 'scenes', data: thread.data as unknown as LocationScenes }] : [])];
  for (const f of sceneFiles) {
    for (const sc of f.data.scenes ?? []) {
      const at = `${f.dir}/${f.name} ${sc.id}`;
      const conds = (sc.lines ?? []).map((l) => l.if);
      if (!conds.some(Boolean)) continue;
      if (sc.mode === 'overhear' || sc.trigger || !sc.id.startsWith('sc:')) {
        out.push({ level: 'error', where: at, msg: 'реплики с условием бывают только в обычных сценах' });
        continue;
      }
      const groups = conditionGroups(conds);
      groups.forEach((g) => used.add(g[0].flag));
      for (const msg of conditionIssues(groups, flags, sc.chapter)) out.push({ level: 'error', where: at, msg });
      if (sc.lines.every((l) => l.if)) out.push({ level: 'error', where: at, msg: 'в сцене нет реплик без условия' });
    }
  }
  for (const k of flags.keys()) if (!used.has(k)) out.push({ level: 'warning', where: 'missions', msg: `флаг "${k}" не меняет ни одной реплики` });
  return out;
}

/** Слухов на главу (задача 13.7). */
export const RUMORS_PER_CHAPTER = 4;
/** Доля незнакомых слов в слухе: он короткий, одно имя собственное уже 8%. */
export const RUMOR_UNKNOWN_MAX = 0.15;

/**
 * Слухи города (задача 13.7): id `rm:<глава>.<n>`, говорит житель или Летописец, реплика и перевод, на каждую главу
 * не меньше `RUMORS_PER_CHAPTER`. Незнакомые к уровню главы слова — в `gloss`, их не больше `RUMOR_UNKNOWN_MAX`.
 */
export function validateRumors(
  file: { rumors?: { id: string; chapter: number; who: string; es: string; ru: string; gloss?: Record<string, string> }[] } | undefined,
  speakers: ReadonlySet<string>,
  coverage?: (text: string, level: number) => { total: number; unknown: string[] },
): Issue[] {
  const out: Issue[] = [];
  const at = 'rumors.json';
  if (!file) return [{ level: 'error', where: at, msg: 'нет файла слухов' }];
  const ids = new Set<string>();
  for (const r of file.rumors ?? []) {
    const where = `${at} ${r.id}`;
    const err = (msg: string) => out.push({ level: 'error', where, msg });
    if (!/^rm:[1-5]\.\d+$/.test(r.id) || r.id.split(':')[1].split('.')[0] !== String(r.chapter)) err('id должен быть rm:<глава>.<n>');
    if (ids.has(r.id)) err('дубль id');
    ids.add(r.id);
    if (!speakers.has(r.who)) err(`неизвестный житель "${r.who}"`);
    if (empty(r.es) || empty(r.ru)) err('нет реплики или перевода');
    else if (!/\p{Script=Latin}/u.test(r.es) || /\p{Script=Cyrillic}/u.test(r.es)) err('реплика не на изучаемом языке');
    const gloss = Object.fromEntries(Object.entries(r.gloss ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const keys = new Set(sceneWords(r.es ?? '').flatMap((p) => ('key' in p ? [normalize(p.key)] : [])));
    for (const [k, v] of Object.entries(gloss)) {
      if (empty(v)) err(`пустой перевод в gloss: "${k}"`);
      if (!keys.has(normalize(k))) out.push({ level: 'warning', where, msg: `слова "${k}" из gloss нет в реплике` });
    }
    const level = CHAPTERS[r.chapter - 1]?.levels.at(-1);
    if (coverage && level && !empty(r.es)) {
      const c = coverage(r.es, level);
      const unknown = [...new Set(c.unknown)];
      if (c.unknown.length > Math.max(1, Math.floor(c.total * RUMOR_UNKNOWN_MAX))) err(`незнакомых слов к главе ${r.chapter}: ${unknown.join(', ')}`);
      const bare = unknown.filter((t) => !gloss[t]);
      if (bare.length) out.push({ level: 'warning', where, msg: `нет в словаре уровня ${level} и в gloss: ${bare.join(', ')}` });
    }
  }
  for (const ch of [1, 2, 3, 4, 5]) {
    const n = (file.rumors ?? []).filter((r) => r.chapter === ch).length;
    if (n < RUMORS_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `слухов главы ${ch}: ${n}, нужно не меньше ${RUMORS_PER_CHAPTER}` });
  }
  return out;
}

/**
 * Дневник путника (задача 13.8): id `dy:<глава>.<n>`, тема из `DIARY_TOPICS`, факт по-русски, цитата — реплика источника
 * слово в слово. Источник: разговор `sc:` или сцена Летописца `th:` с номером реплики (не реплика героя и не реплика
 * с условием: её видят не все) или слух `rm:`. Глава записи — глава источника, записей на главу не меньше `DIARY_PER_CHAPTER`.
 */
export function validateDiary(
  file: { entries?: { id: string; chapter: number; topic: string; from: string; line?: number; ru: string; es: string }[] } | undefined,
  sources: { scenes: Scene[]; rumors: { id: string; chapter: number; es: string }[] },
): Issue[] {
  const out: Issue[] = [];
  const at = 'diary.json';
  if (!file) return [{ level: 'error', where: at, msg: 'нет файла дневника' }];
  const scenes = new Map(sources.scenes.map((s) => [s.id, s]));
  const rumors = new Map(sources.rumors.map((r) => [r.id, r]));
  const ids = new Set<string>();
  const froms = new Set<string>();
  for (const e of file.entries ?? []) {
    const where = `${at} ${e.id}`;
    const err = (msg: string) => out.push({ level: 'error', where, msg });
    if (!/^dy:[1-5]\.\d+$/.test(e.id) || e.id.split(':')[1].split('.')[0] !== String(e.chapter)) err('id должен быть dy:<глава>.<n>');
    if (ids.has(e.id)) err('дубль id');
    ids.add(e.id);
    if (!(e.topic in DIARY_TOPICS)) err(`неизвестная тема "${e.topic}"`);
    if (empty(e.ru) || !/\p{Script=Cyrillic}/u.test(e.ru)) err('нет факта по-русски');
    const key = `${e.from}#${e.line ?? ''}`;
    if (froms.has(key)) err(`источник "${key}" уже у другой записи`);
    froms.add(key);
    if (e.from.startsWith('rm:')) {
      const r = rumors.get(e.from);
      if (!r) err(`нет слуха "${e.from}"`);
      else {
        if (r.chapter !== e.chapter) err(`слух из главы ${r.chapter}`);
        if (r.es !== e.es) err('цитата не совпадает со слухом');
      }
      continue;
    }
    const sc = scenes.get(e.from);
    if (!sc || !/^(sc|th):/.test(e.from)) {
      err(`нет разговора "${e.from}"`);
      continue;
    }
    if (sc.chapter !== e.chapter) err(`разговор из главы ${sc.chapter}`);
    const line = e.line === undefined ? undefined : sc.lines[e.line];
    if (!line) err(`нет реплики ${e.line}`);
    else {
      if (line.who === 'hero') err('цитата — реплика героя');
      if (line.if) err('реплика с условием: её видят не все');
      if (line.es !== e.es) err('цитата не совпадает с репликой');
    }
  }
  for (const ch of [1, 2, 3, 4, 5]) {
    const n = (file.entries ?? []).filter((e) => e.chapter === ch).length;
    if (n < DIARY_PER_CHAPTER) out.push({ level: 'error', where: at, msg: `записей главы ${ch}: ${n}, нужно не меньше ${DIARY_PER_CHAPTER}` });
  }
  return out;
}
