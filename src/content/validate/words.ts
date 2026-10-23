import { normalize, normalizeIn, splitArticle, stripAccents } from '../../domain/answer';
import { LANGS, type Lang } from '../../lang';
import { CHAPTERS as PLAN, PLACE_EXPRESSIONS, PLACE_LEVEL_MAX } from '../vocabPlan';
import { EXPRESSION_LEVEL, isExpression, KINDS, REGISTERS, USAGES } from '../../domain/expression';
import { LOCATION_IDS, type LocationWords, type ScrollFile, type Word } from '../schema';
import { CEFR, type Issue, POS, empty } from './common';

/** Слова мест и свитков: поля, часть речи, артикль и род, выражения уровня 7, пометки употребления, пары регистров, одинаковые переводы. */

/** Артикль существительного: определённый, по роду — правила языка (`articleIssue` в профиле). */
function checkArticle(w: Word, form: string, where: string, out: Issue[], lang: Lang) {
  const p = LANGS[lang];
  const { article, core } = splitArticle(form, lang);
  if (!article || ![...p.singular, ...p.plural].includes(article)) {
    out.push({ level: 'error', where, msg: `существительное без определённого артикля: "${form}"` });
    return;
  }
  const msg = p.articleIssue?.(w.gender!, article, core);
  if (msg) out.push({ level: 'error', where, msg });
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
export function checkWord(w: Word, at: string, lang: Lang, out: Issue[]) {
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

  if (w.pos === 'noun' && !LANGS[lang].gender) {
    if (w.gender) out.push({ level: 'error', where: at, msg: `род у существительного: у ${LANGS[lang].genitive} рода нет` });
  } else if (w.pos === 'noun') {
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
  } else if (w.example && !empty(w.example.es) && LANGS[lang].analyze) {
    // Язык с разбором аффиксов (турецкий): слово в примере стоит в форме (kitap → kitabı, gitmek → gidiyorum),
    // обрезанная основа его не найдёт. Каждое слово записи ищется в примере как есть или формой, которая в него
    // разбирается: yardım etmek — «yardım eder misin».
    const analyze = LANGS[lang].analyze!;
    const words = (s: string) => normalizeIn(s, lang).split(/[^\p{L}]+/u).filter(Boolean);
    const ex = words(w.example.es);
    const found = words(w.es).every((l) => ex.some((t) => t === l || analyze(t, (x) => x === l).includes(l)));
    if (!found) out.push({ level: 'warning', where: at, msg: `в примере нет слова "${w.es}"` });
  } else if (w.example && !empty(w.example.es)) {
    const ex = stripAccents(normalize(w.example.es));
    let core = stripAccents(splitArticle(w.es, lang).core);
    // Возвратный глагол: bañarse → bañar, lavarsi → lavar; в примере будет bañarnos, mi lavo.
    const { reflexive, infinitiveEnd } = LANGS[lang];
    if (w.pos === 'verb' && reflexive && core.endsWith(reflexive)) core = core.slice(0, -reflexive.length);
    // У итальянских глаголов окончание длиннее: parlare → parl.
    const cut = w.pos === 'verb' && core.length > 5 ? infinitiveEnd : 2;
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
    if (data.words.length > plan.scrollMax) out.push({ level: 'error', where: name, msg: `${data.words.length} слов, больше потолка свитка ${plan.scrollMax}` });
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
