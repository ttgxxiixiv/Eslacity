import { normalize, splitArticle, stripAccents } from '../domain/answer';
import { LOCATION_IDS, type GrammarLesson, type LocationWords, type Word } from './schema';

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

function checkArticle(w: Word, form: string, where: string, out: Issue[]) {
  const { article, core } = splitArticle(form);
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

export function validateWords(files: { name: string; data: LocationWords }[]): Issue[] {
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
          checkArticle(w, w.es, at, out);
          if (w.latam) checkArticle(w, w.latam, `${at} (latam)`, out);
          for (const a of w.alt ?? []) checkArticle(w, a, `${at} (alt)`, out);
        }
      } else {
        if (w.gender) out.push({ level: 'warning', where: at, msg: 'род у не-существительного' });
        if (w.pos !== 'phrase' && splitArticle(w.es).article) {
          out.push({ level: 'error', where: at, msg: `артикль у части речи ${w.pos}` });
        }
      }

      for (const a of w.alt ?? []) if (empty(a)) out.push({ level: 'error', where: at, msg: 'пустой alt' });
      if (w.latam !== undefined && empty(w.latam)) out.push({ level: 'error', where: at, msg: 'пустой latam' });

      if (w.example && !empty(w.example.es)) {
        const ex = stripAccents(normalize(w.example.es));
        let core = stripAccents(splitArticle(w.es).core);
        // Возвратный глагол: bañarse → bañar, в примере будет bañarnos.
        if (w.pos === 'verb' && core.endsWith('se')) core = core.slice(0, -2);
        const stem = core.length > 4 ? core.slice(0, core.length - 2) : core;
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
      if (n < 10 || n > 12) out.push({ level: 'error', where, msg: `уровень ${lvl}: ${n} слов, нужно 10-12` });
    }
  }
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
    for (const [label, list] of [
      ['', l.exercises ?? []],
      [' (es-419)', (l.exercises ?? []).filter((e) => e.region !== 'es')],
    ] as const) {
      const kinds = new Set(list.map((e) => e.kind));
      for (const k of ['choose', 'gap', 'truefalse']) {
        if (!kinds.has(k as never)) out.push({ level: 'error', where: at, msg: `нет упражнения типа ${k}${label}` });
      }
    }
    (l.exercises ?? []).forEach((e, i) => {
      const w = `${at} упр.${i + 1}`;
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
