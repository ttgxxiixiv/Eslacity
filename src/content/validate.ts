import { normalize, splitArticle, stripAccents } from '../domain/answer';
import type { Lang } from '../lang';
import { PLACE_LEVEL_MAX } from './vocabPlan';
import { LOCATION_IDS, type GrammarLesson, type LocationWords, type NpcsFile, type Word } from './schema';

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

      if (!w.id.startsWith(`${data.location}.`)) {
        out.push({ level: 'error', where: at, msg: `id должен начинаться с "${data.location}."` });
      }
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: `дубль id, уже есть в ${ids.get(w.id)}` });
      ids.set(w.id, name);

      const key = normalize(w.es);
      if (esSeen.has(key)) out.push({ level: 'error', where: at, msg: `дубль "${w.es}" (${esSeen.get(key)})` });
      esSeen.set(key, w.id);

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

/** Жители: по одному на каждое место, уникальные id, заполненные поля, голос и портрет в допустимых пределах. */
export function validateNpcs(file: NpcsFile | undefined): Issue[] {
  const out: Issue[] = [];
  const where = 'npcs.json';
  if (!file?.npcs?.length) return [{ level: 'error', where, msg: 'нет жителей' }];
  const ids = new Set<string>();
  const places = new Map<string, string>();
  for (const n of file.npcs) {
    const at = `${where} ${n.id ?? '?'}`;
    for (const f of ['id', 'name', 'role', 'character'] as const) if (empty(n[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
    if (empty(n.greeting?.es) || empty(n.greeting?.ru)) out.push({ level: 'error', where: at, msg: 'пустое приветствие' });
    if (ids.has(n.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
    ids.add(n.id);
    if (!(LOCATION_IDS as readonly string[]).includes(n.location)) out.push({ level: 'error', where: at, msg: `неизвестное место "${n.location}"` });
    else if (places.has(n.location)) out.push({ level: 'error', where: at, msg: `в месте ${n.location} уже живёт ${places.get(n.location)}` });
    else places.set(n.location, n.id);
    if (n.gender !== 'm' && n.gender !== 'f') out.push({ level: 'error', where: at, msg: `пол "${n.gender}"` });
    const { pitch, rate } = n.voice ?? {};
    if (!(pitch >= 0.5 && pitch <= 1.5) || !(rate >= 0.7 && rate <= 1.3)) out.push({ level: 'error', where: at, msg: 'голос вне пределов (pitch 0.5–1.5, rate 0.7–1.3)' });
    const lk = n.look;
    if (!lk || ![1, 2, 3, 4].includes(lk.skin) || !NPC_STYLES.has(lk.style) || !COLOR.test(lk.hair) || !COLOR.test(lk.outfit) || !COLOR.test(lk.pants)) {
      out.push({ level: 'error', where: at, msg: 'неверный портрет (look)' });
    } else {
      for (const e of lk.extra) if (!NPC_EXTRAS.has(e)) out.push({ level: 'error', where: at, msg: `неизвестная деталь портрета "${e}"` });
    }
  }
  for (const loc of LOCATION_IDS) if (!places.has(loc)) out.push({ level: 'error', where, msg: `в месте ${loc} нет жителя` });
  return out;
}
