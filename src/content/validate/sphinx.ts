import { normalize } from '../../domain/answer';
import { SPHINX_LINES, type SphinxSpeaker, type GrammarExercise, type SphinxFile } from '../schema';
import { type Issue, coverageIssues, empty, glossIssues, optionIssues, wordCount } from './common';
import { checkExercise } from './grammar';

/** Сфинкс: загадки слова, слуха и мудрости, реплики Сфинкса. */

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
