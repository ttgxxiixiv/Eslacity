import { normalize, splitArticle, stripAccents } from '../domain/answer';
import type { Lang } from '../lang';
import { CHAPTERS as PLAN, PLACE_LEVEL_MAX } from './vocabPlan';
import { expandOptional, fullPhrase, optionalError, PHRASE_MAX_WORDS, PHRASE_PREFIX, phraseWords } from '../domain/phrase';
import { answersOnPath, missionGraphIssues } from '../domain/mission';
import { LOCATION_IDS, type Chronicler, type GrammarLesson, type LocationMissions, type LocationPhrases, type LocationScenes, type Phrase, type LocationWords, type NpcsFile, type ScrollFile, type Word } from './schema';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  msg: string;
}

const POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'num', 'interj', 'phrase']);
const CEFR = new Set(['A1', 'A2', 'B1']);

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

/** Проверки одного слова: поля, часть речи, артикль и род, пример содержит слово. Общие для мест и свитков. */
function checkWord(w: Word, at: string, lang: Lang, out: Issue[]) {
  for (const f of ['id', 'es', 'ru', 'pos', 'cefr'] as const) {
    if (empty(w[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
  }
  if (!w.example || empty(w.example.es) || empty(w.example.ru)) {
    out.push({ level: 'error', where: at, msg: 'пустой пример' });
  }
  if (![1, 2, 3, 4, 5].includes(w.level)) out.push({ level: 'error', where: at, msg: `уровень ${w.level}` });
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

  if (w.example && !empty(w.example.es)) {
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

    data.words.forEach((w, i) => {
      const at = `${name}#${i} ${w.id ?? '?'}`;
      checkWord(w, at, lang, out);
      if (empty(w.id) || empty(w.es)) return;

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

      perLevel.set(w.level, (perLevel.get(w.level) ?? 0) + 1);
    });

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
      for (const k of ['choose', 'gap', 'truefalse']) {
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
      if (e.options.length < 2 || e.options.some(empty)) out.push({ level: 'error', where: w, msg: 'мало или пустые варианты' });
      if (new Set(e.options.map(normalize)).size !== e.options.length) out.push({ level: 'error', where: w, msg: 'одинаковые варианты' });
      if (!Number.isInteger(e.answer) || e.answer < 0 || e.answer >= e.options.length) {
        out.push({ level: 'error', where: w, msg: `answer ${e.answer} вне вариантов` });
      }
      if (e.kind === 'gap') {
        const gaps = e.sentence.split('___').length - 1;
        if (gaps !== 1) out.push({ level: 'error', where: w, msg: `в предложении ${gaps} пропусков вместо одного` });
        if (empty(e.ru)) out.push({ level: 'error', where: w, msg: 'нет перевода' });
      } else if (empty(e.prompt)) out.push({ level: 'error', where: w, msg: 'пустой prompt' });
    });
  }
  return out;
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
  const lk = n.look;
  if (!lk || ![1, 2, 3, 4].includes(lk.skin) || !NPC_STYLES.has(lk.style) || !COLOR.test(lk.hair) || !COLOR.test(lk.outfit) || !COLOR.test(lk.pants)) {
    out.push({ level: 'error', where: at, msg: 'неверный портрет (look)' });
  } else {
    for (const e of lk.extra) if (!NPC_EXTRAS.has(e)) out.push({ level: 'error', where: at, msg: `неизвестная деталь портрета "${e}"` });
  }
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

export interface SceneChecks {
  /** Место → id его жителя. */
  residents: Record<string, string>;
  /** Слова реплик: всего и незнакомые к уровню главы (с повторами, строчными). */
  coverage?: (text: string, level: number) => { total: number; unknown: string[] };
}

export interface SceneReport {
  scenes: number;
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
  const report: SceneReport = { scenes: 0, words: 0, unknown: 0 };
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
      if (sc.id !== `sc:${data.location}.${sc.chapter}`) out.push({ level: 'error', where: at, msg: `id должен быть "sc:${data.location}.${sc.chapter}"` });
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
      });
      const text = lines.map((l) => l.es).join(' ');
      const gloss = Object.fromEntries(Object.entries(sc.gloss ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      for (const [k, v] of Object.entries(gloss)) {
        if (empty(v)) out.push({ level: 'error', where: at, msg: `пустой перевод в gloss: "${k}"` });
        if (!normalize(text).split(' ').includes(normalize(k))) out.push({ level: 'warning', where: at, msg: `слова "${k}" из gloss нет в репликах` });
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
 * не меньше пяти ответов на пути. Реплики жителя (с реакциями) — не больше 7% незнакомых слов.
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
