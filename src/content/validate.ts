import { normalize, splitArticle, stripAccents } from '../domain/answer';
import type { Lang } from '../lang';
import { CHAPTERS as PLAN, PLACE_EXPRESSIONS, PLACE_LEVEL_MAX } from './vocabPlan';
import { EXPRESSION_LEVEL, isExpression, KINDS, REGISTERS } from '../domain/expression';
import { expandOptional, fullPhrase, optionalError, PHRASE_MAX_WORDS, PHRASE_PREFIX, phraseWords } from '../domain/phrase';
import { answersOnPath, DISPUTE_FROM_CHAPTER, isDispute, missionGraphIssues } from '../domain/mission';
import { LISTEN_GUARDIAN_CHAPTERS } from '../domain/guardian';
import { sceneWords } from '../domain/sceneText';
import { conjugate, generated, participle, TENSES, type Tense } from '../domain/verbs';
import { phraseTokens } from '../domain/phraseSteps';
import { LETTER_MAX_WORDS, LETTER_MIN_WORDS, wordCount as letterWords } from '../domain/letter';
import { LOCATION_IDS, type Chronicler, type GrammarLesson, type GuardiansFile, type LettersFile, type NpcLook, type LocationMissions, type LocationPhrases, type LocationScenes, type Phrase, type Scene, type LocationWords, type NpcsFile, type ScrollFile, type VerbsFile, type Word } from './schema';

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
      if (w.latam) checkArticle(w, w.latam, `${at} (latam)`, out, lang);
      for (const a of w.alt ?? []) checkArticle(w, a, `${at} (alt)`, out, lang);
    }
  } else {
    if (w.gender) out.push({ level: 'warning', where: at, msg: 'род у не-существительного' });
    if (w.pos !== 'phrase' && w.es.includes(' ') && splitArticle(w.es, lang).article) {
      out.push({ level: 'error', where: at, msg: `артикль у части речи ${w.pos}` });
    }
  }

  for (const a of w.alt ?? []) if (empty(a)) out.push({ level: 'error', where: at, msg: 'пустой alt' });
  if (w.latam !== undefined && empty(w.latam)) out.push({ level: 'error', where: at, msg: 'пустой latam' });

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

      // С уровня 5 уровень места — это глава, и CEFR слова должен быть CEFR главы: 5 — B1, 6 — B2.
      const plan = PLAN.find((c) => c.levels.includes(w.level));
      if (w.level >= 5 && plan && w.cefr !== plan.cefr) out.push({ level: 'error', where: at, msg: `у уровня ${w.level} CEFR ${plan.cefr}, а не ${w.cefr}` });
      else if (w.level < 5 && (w.cefr === 'B1' || w.cefr === 'B2' || w.cefr === 'C1')) out.push({ level: 'error', where: at, msg: `CEFR ${w.cefr} на уровне ${w.level}` });

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

export function validateGrammar(files: { name: string; data: GrammarLesson }[], lang: Lang = 'es'): Issue[] {
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
    // Типы заданий должны остаться и без vosotros (вариант es-419).
    const variants: [string, typeof l.exercises][] = [['', l.exercises ?? []]];
    if (lang === 'es') variants.push([' (es-419)', (l.exercises ?? []).filter((e) => e.region !== 'es')]);
    else if ((l.exercises ?? []).some((e) => e.region)) out.push({ level: 'error', where: at, msg: 'region бывает только у испанских уроков' });
    for (const [label, list] of variants) {
      const kinds = new Set(list.map((e) => e.kind));
      // С задачи 5.3 в каждом уроке есть и продуктивные задания: сборка и ввод формы.
      for (const k of ['choose', 'gap', 'truefalse', 'build', 'type']) {
        if (!kinds.has(k as never)) out.push({ level: 'error', where: at, msg: `нет упражнения типа ${k}${label}` });
      }
    }
    const exIds = new Set<string>();
    const idForm = new RegExp(`^${l.id?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[1-9]\\d*$`);
    (l.exercises ?? []).forEach((e, i) => {
      const w = `${at} упр.${i + 1}`;
      if (empty(e.id)) out.push({ level: 'error', where: w, msg: 'нет id: запустите npx tsx scripts/add-exercise-ids.ts' });
      else if (!idForm.test(e.id)) out.push({ level: 'error', where: w, msg: `id "${e.id}" не вида ${l.id}.<номер>` });
      else if (exIds.has(e.id)) out.push({ level: 'error', where: w, msg: `дубль id ${e.id}` });
      exIds.add(e.id);
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
    });
  }
  return out;
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
    for (const f of ['greeting', 'win', 'lose'] as const) if (empty(g[f]?.es) || empty(g[f]?.ru)) out.push({ level: 'error', where: at, msg: `пустая реплика ${f}` });
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

/** Сколько глаголов должно быть в кузнице. */
export const VERBS_MIN = 60;

const VERB_END: Record<Lang, RegExp> = { es: /(ar|er|ir|ír)$/, it: /(are|ere|ire)$/ };

/**
 * Кузница глаголов (задача 5.5): кузнец с репликой и портретом, не меньше 60 разных глаголов с переводом.
 * Записанная строка времени — шесть непустых форм, и она должна отличаться от того, что дал бы генератор окончаний:
 * правильные формы не записываются, генератор и данные не расходятся молча.
 */
export function validateVerbs(file: VerbsFile | undefined, lang: Lang): Issue[] {
  const out: Issue[] = [];
  const where = 'verbs.json';
  if (!file) return [{ level: 'error', where, msg: 'нет файла глаголов' }];
  const s = file.smith;
  if (!s) out.push({ level: 'error', where, msg: 'нет кузнеца' });
  else {
    const at = `${where} кузнец`;
    for (const f of ['name', 'role'] as const) if (empty(s[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
    if (s.gender !== 'm' && s.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${s.gender}"` });
    if (empty(s.greeting?.es) || empty(s.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
    const { pitch, rate } = s.voice ?? {};
    if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
    checkLook(s.look, at, out);
  }
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
      if (w.cefr !== plan.cefr) out.push({ level: 'error', where: at, msg: `CEFR ${w.cefr}, у главы ${plan.chapter} — ${plan.cefr}` });
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
    if (!LOCATION_IDS.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
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
      if (overhear) out.push(...overhearIssues(sc, at, checks.residents[data.location], npcIds, checks.pitch));
      const text = lines.map((l) => l.es).join(' ');
      // Слова реплик так же, как их нажимают на экране сцены: «dell'Elisir» — это «dell'» и «elisir».
      const keys = new Set(lines.flatMap((l) => sceneWords(l.es ?? '').flatMap((p) => ('key' in p ? [normalize(p.key)] : []))));
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
    }
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
  /** Фразы мест: ответы героя — только фразы своего места. */
  phrases: Record<string, Phrase[]>;
  /** id существующих сцен. */
  scenes: ReadonlySet<string>;
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
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
    if (!LOCATION_IDS.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
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
