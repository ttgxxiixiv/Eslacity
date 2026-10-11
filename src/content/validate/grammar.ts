import { normalize } from '../../domain/answer';
import { REGISTERS } from '../../domain/expression';
import { phraseTokens } from '../../domain/phraseSteps';
import type { GrammarExercise, GrammarLesson } from '../schema';
import { type Issue, empty, wordCount } from './common';

/** Уроки грамматики и их упражнения: базовые виды, сборка из плиток, ввод и виды C1. */

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
export function checkExercise(e: GrammarExercise, w: string, out: Issue[]) {
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
