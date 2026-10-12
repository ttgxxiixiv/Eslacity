import { LANGS, type Lang } from '../lang';
import type { Tense, VerbData } from '../langs/types';
import { VERB_CARD_PREFIX } from './itemId';

/**
 * Кузница глаголов (задача 5.5): спряжение глагола по лицам и временам. Правильные формы строит генератор окончаний
 * из профиля языка (`src/langs/<язык>/verbs.ts`), у неправильных глаголов в `verbs.json` записано только то, что
 * отличается: вся строка времени (`forms`), форма «я» настоящего (`yo`), основа будущего (`fut`), причастие (`pp`),
 * чередование в основе у испанских глаголов (`ch`), `isc` и вспомогательный `essere` у итальянских.
 */

export type { EsTense } from '../langs/es/verbs';
export type { ItTense } from '../langs/it/verbs';
export type { Tense, VerbData } from '../langs/types';

const VERBS = (lang: Lang) => LANGS[lang].verbs;

/** Времена языка по порядку. */
export const TENSES = Object.fromEntries(Object.values(LANGS).map((p) => [p.id, p.verbs.tenses.map((t) => t.id)])) as Record<Lang, Tense[]>;

/** Название времени для задания. */
export const TENSE_RU = Object.fromEntries(Object.values(LANGS).flatMap((p) => p.verbs.tenses.map((t) => [t.id, t.ru]))) as Record<Tense, string>;

/** Урок, после которого время открывается в кузнице. */
export const TENSE_LESSON = Object.fromEntries(
  Object.values(LANGS).map((p) => [p.id, Object.fromEntries(p.verbs.tenses.map((t) => [t.id, t.lesson]))]),
) as Record<Lang, Partial<Record<Tense, string>>>;

/** Лица от «я» до «они». */
export const PERSONS = Object.fromEntries(Object.values(LANGS).map((p) => [p.id, p.verbs.persons])) as Record<Lang, string[]>;

/** Причастие: hablado, comido; parlato, creduto, dormito — если не записано своё. */
export const participle = (v: VerbData, lang: Lang): string => VERBS(lang).participle(v);

/** Шесть форм глагола во времени, от «я» до «они». */
export const conjugate = (v: VerbData, tense: Tense, lang: Lang): string[] => VERBS(lang).conjugate(v, tense);

/** Строка времени без своих записей: что дал бы генератор (для валидатора). */
export function generated(v: VerbData, tense: Tense, lang: Lang): string[] {
  const rest = { ...v, forms: { ...v.forms } };
  delete rest.forms[tense];
  return conjugate(rest, tense, lang);
}

// ——— Задания и карточки ———

export const VERB_PREFIX = VERB_CARD_PREFIX;

/** Карточка формы: `v:hablar.presente.3` (лицо с 1). */
export const verbCardId = (inf: string, tense: Tense, person: number) => `${VERB_PREFIX}${inf}.${tense}.${person + 1}`;

export function parseVerbCard(id: string): { inf: string; tense: Tense; person: number } | null {
  const m = id.match(/^v:(.+)\.([a-z]+)\.([1-6])$/);
  return m ? { inf: m[1], tense: m[2] as Tense, person: Number(m[3]) - 1 } : null;
}

export interface ForgeTask {
  inf: string;
  ru: string;
  tense: Tense;
  person: number;
  answer: string;
  /** Равноправные ответы: женский род причастия при essere (sono andata, siamo andate). */
  alt: string[];
  /** Формы того же глагола в открытых временах с подписью («yo · presente»): ответ другой формой — причина ошибки. */
  forms: { form: string; label: string }[];
}

/** Открытые времена: урок времени пройден. */
export const openTenses = (lang: Lang, isDone: (lessonId: string) => boolean): Tense[] =>
  TENSES[lang].filter((t) => {
    const l = TENSE_LESSON[lang][t];
    return !!l && isDone(l);
  });

/**
 * Плавка: сначала формы, которые пора перековать (карточки `v:` к повтору), потом случайные глагол × лицо × время
 * из открытых времён, без повторов.
 */
export function forgeTasks(
  verbs: VerbData[], lang: Lang, tenses: Tense[], due: string[], size: number, rng: () => number,
): ForgeTask[] {
  const byInf = new Map(verbs.map((v) => [v.inf, v]));
  const persons = [0, 1, 2, 3, 4, 5];
  // Время, которого у глагола не бывает (английские глаголы состояния без Continuous), в плавку не идёт.
  const usable = (v: VerbData, t: Tense) => !VERBS(lang).skip?.(v, t);
  const task = (v: VerbData, tense: Tense, person: number): ForgeTask => {
    const answer = conjugate(v, tense, lang)[person];
    const forms = tenses.filter((t) => usable(v, t)).flatMap((t) => {
      const all = conjugate(v, t, lang);
      return persons.map((p) => ({ form: all[p], label: `${PERSONS[lang][p]} · ${TENSE_RU[t]}` }));
    });
    return { inf: v.inf, ru: v.ru, tense, person, answer, alt: VERBS(lang).feminine?.(v, tense, answer) ?? [], forms };
  };
  const out: ForgeTask[] = [];
  const seen = new Set<string>();
  for (const id of due) {
    const c = parseVerbCard(id);
    const v = c && byInf.get(c.inf);
    if (!c || !v || !tenses.includes(c.tense) || !usable(v, c.tense) || !persons.includes(c.person) || out.length >= size) continue;
    out.push(task(v, c.tense, c.person));
    seen.add(id);
  }
  if (!tenses.length || !verbs.length) return out;
  for (let guard = 0; out.length < size && guard < size * 50; guard++) {
    const v = verbs[Math.floor(rng() * verbs.length)];
    const tense = tenses[Math.floor(rng() * tenses.length)];
    const person = persons[Math.floor(rng() * persons.length)];
    const id = verbCardId(v.inf, tense, person);
    if (seen.has(id) || !usable(v, tense)) continue;
    seen.add(id);
    out.push(task(v, tense, person));
  }
  return out;
}
