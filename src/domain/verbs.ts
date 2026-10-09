import type { Lang } from '../lang';
import { VERB_CARD_PREFIX } from './itemId';

/**
 * Кузница глаголов (задача 5.5): спряжение глагола по лицам и временам. Правильные формы строит генератор окончаний,
 * у неправильных глаголов в `verbs.json` записано только то, что отличается: вся строка времени (`forms`), форма «я»
 * настоящего (`yo`), основа будущего (`fut`), причастие (`pp`), чередование в основе у испанских глаголов (`ch`),
 * `isc` и вспомогательный `essere` у итальянских.
 */

export type EsTense = 'presente' | 'indefinido' | 'imperfecto' | 'perfecto' | 'futuro' | 'condicional' | 'subjuntivo';
export type ItTense = 'presente' | 'passato' | 'imperfetto' | 'futuro' | 'condizionale' | 'congiuntivo';
export type Tense = EsTense | ItTense;

export interface VerbData {
  inf: string;
  ru: string;
  /** Строки времён, которые не строятся по правилам: 6 форм, от «я» до «они». */
  forms?: Partial<Record<Tense, string[]>>;
  /** Неправильная форма «я» в настоящем (tengo, conozco); испанский субхунтив берёт основу от неё. */
  yo?: string;
  /** Основа будущего и условного (tendr, sar). */
  fut?: string;
  /** Причастие (hecho, fatto). */
  pp?: string;
  /** Чередование в основе у испанских глаголов: pensar → ie, dormir → ue, pedir → i. */
  ch?: 'ie' | 'ue' | 'i';
  /** Итальянские глаголы на -ire с -isc-: finisco. */
  isc?: boolean;
  /** Итальянский passato prossimo с essere: sono andato. */
  aux?: 'essere';
}

export const TENSES: Record<Lang, Tense[]> = {
  es: ['presente', 'indefinido', 'imperfecto', 'perfecto', 'futuro', 'condicional', 'subjuntivo'],
  it: ['presente', 'passato', 'imperfetto', 'futuro', 'condizionale', 'congiuntivo'],
};

/** Название времени для задания. */
export const TENSE_RU: Record<Tense, string> = {
  presente: 'настоящее',
  indefinido: 'прошедшее, indefinido',
  imperfecto: 'прошедшее, imperfecto',
  perfecto: 'pretérito perfecto',
  futuro: 'будущее',
  condicional: 'условное',
  subjuntivo: 'presente de subjuntivo',
  passato: 'passato prossimo',
  imperfetto: 'imperfetto',
  condizionale: 'condizionale',
  congiuntivo: 'congiuntivo presente',
};

/** Урок, после которого время открывается в кузнице. */
export const TENSE_LESSON: Record<Lang, Partial<Record<Tense, string>>> = {
  es: {
    presente: 'a1.11-presente-ar',
    indefinido: 'a2.23-indefinido-regular',
    imperfecto: 'a2.27-imperfecto-formacion',
    perfecto: 'a2.20-perfecto-formacion',
    futuro: 'b11.01-futuro',
    condicional: 'b11.04-condicional',
    subjuntivo: 'b11.06-subjuntivo-formacion',
  },
  it: {
    presente: 'a1.12-presente-are',
    passato: 'a2.07-passato-prossimo-avere',
    imperfetto: 'a2.12-imperfetto-formazione',
    futuro: 'b11.01-futuro',
    condizionale: 'b11.04-condizionale',
    congiuntivo: 'b11.06-congiuntivo-formazione',
  },
};

export const PERSONS: Record<Lang, string[]> = {
  es: ['yo', 'tú', 'él / ella', 'nosotros', 'vosotros', 'ellos'],
  it: ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro'],
};

// ——— Испанский ———

const ES_END = {
  presente: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
  indefinido: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
  imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
  subjuntivo: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
};
const ES_FUT = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const ES_COND = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
const ES_HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

/** Группа испанского глагола и основа: hablar → ar, habl; oír → ir, o. */
function esSplit(inf: string): { group: 'ar' | 'er' | 'ir'; stem: string } {
  const group = plain(inf.slice(-2)) as 'ar' | 'er' | 'ir';
  return { group, stem: inf.slice(0, -2) };
}

/** Чередование: последняя e → ie или i, последняя o/u → ue. raise — e → i, o → u (у глаголов на -ir). */
function esChange(stem: string, ch: VerbData['ch'], raise = false): string {
  const at = (re: RegExp) => {
    const m = [...stem.matchAll(re)].pop();
    return m?.index ?? -1;
  };
  if (!ch) return stem;
  if (ch === 'ue') {
    const i = at(/[ou]/g);
    return i < 0 ? stem : stem.slice(0, i) + (raise ? 'u' : 'ue') + stem.slice(i + 1);
  }
  const i = at(/e/g);
  return i < 0 ? stem : stem.slice(0, i) + (raise || ch === 'i' ? 'i' : 'ie') + stem.slice(i + 1);
}

/** Перед e: c → qu, g → gu, z → c (busqué, llegue, empiece). */
const esBeforeE = (stem: string) => stem.replace(/c$/, 'qu').replace(/g$/, 'gu').replace(/z$/, 'c');

function esForms(v: VerbData, tense: EsTense): string[] {
  const own = v.forms?.[tense as Tense];
  if (own) return own;
  const { group, stem } = esSplit(v.inf);
  const ir = group === 'ir';
  const P = [0, 1, 2, 5];
  switch (tense) {
    case 'presente': {
      const out = ES_END.presente[group].map((e, i) => (P.includes(i) ? esChange(stem, v.ch) : stem) + e);
      if (v.yo) out[0] = v.yo;
      return out;
    }
    case 'indefinido':
      return ES_END.indefinido[group].map((e, i) => {
        if (i === 0 && group === 'ar') return esBeforeE(stem) + e;
        return (ir && v.ch && (i === 2 || i === 5) ? esChange(stem, v.ch, true) : stem) + e;
      });
    case 'imperfecto':
      return ES_END.imperfecto[group].map((e) => stem + e);
    case 'perfecto':
      return ES_HABER.map((h) => `${h} ${participle(v, 'es')}`);
    case 'futuro':
      return ES_FUT.map((e) => (v.fut ?? v.inf) + e);
    case 'condicional':
      return ES_COND.map((e) => (v.fut ?? v.inf) + e);
    case 'subjuntivo': {
      const yo = esForms(v, 'presente')[0];
      // Основа субхунтива — от формы «я»: tengo → tenga, conozco → conozca.
      if (yo !== esChange(stem, v.ch) + 'o' && yo.endsWith('o')) return ES_END.subjuntivo[group].map((e) => yo.slice(0, -1) + e);
      const fix = (s: string) => (group === 'ar' ? esBeforeE(s) : s);
      return ES_END.subjuntivo[group].map((e, i) =>
        fix(P.includes(i) ? esChange(stem, v.ch) : ir && v.ch ? esChange(stem, v.ch, true) : stem) + e,
      );
    }
  }
}

// ——— Итальянский ———

const IT_END = {
  presente: { are: ['o', 'i', 'a', 'iamo', 'ate', 'ano'], ere: ['o', 'i', 'e', 'iamo', 'ete', 'ono'], ire: ['o', 'i', 'e', 'iamo', 'ite', 'ono'] },
  imperfetto: { are: ['avo', 'avi', 'ava', 'avamo', 'avate', 'avano'], ere: ['evo', 'evi', 'eva', 'evamo', 'evate', 'evano'], ire: ['ivo', 'ivi', 'iva', 'ivamo', 'ivate', 'ivano'] },
  congiuntivo: { are: ['i', 'i', 'i', 'iamo', 'iate', 'ino'], ere: ['a', 'a', 'a', 'iamo', 'iate', 'ano'], ire: ['a', 'a', 'a', 'iamo', 'iate', 'ano'] },
};
const IT_FUT = ['ò', 'ai', 'à', 'emo', 'ete', 'anno'];
const IT_COND = ['ei', 'esti', 'ebbe', 'emmo', 'este', 'ebbero'];
const IT_AVERE = ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'];
const IT_ESSERE = ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'];

/** Окончание к основе: cerc + i → cerchi, mangi + iamo → mangiamo, studi + i → studi. */
function itJoin(stem: string, end: string, group: 'are' | 'ere' | 'ire'): string {
  let s = stem;
  if (group === 'are' && /[cg]$/.test(s) && /^[ie]/.test(end)) s += 'h';
  if (s.endsWith('i') && end.startsWith('i')) s = s.slice(0, -1);
  return s + end;
}

/** Основа будущего: parlare → parler, cercare → cercher, mangiare → manger, credere → creder, dormire → dormir. */
function itFutStem(v: VerbData): string {
  if (v.fut) return v.fut;
  const group = v.inf.slice(-3) as 'are' | 'ere' | 'ire';
  const stem = v.inf.slice(0, -3);
  if (group !== 'are') return stem + group.slice(0, 2);
  if (/[cg]$/.test(stem)) return stem + 'her';
  if (/[cg]i$/.test(stem)) return stem.slice(0, -1) + 'er';
  return stem + 'er';
}

function itForms(v: VerbData, tense: ItTense): string[] {
  const own = v.forms?.[tense as Tense];
  if (own) return own;
  const group = v.inf.slice(-3) as 'are' | 'ere' | 'ire';
  const stem = v.inf.slice(0, -3);
  switch (tense) {
    case 'presente':
      if (v.isc) return ['isco', 'isci', 'isce', 'iamo', 'ite', 'iscono'].map((e) => stem + e);
      return IT_END.presente[group].map((e) => itJoin(stem, e, group));
    case 'imperfetto':
      return IT_END.imperfetto[group].map((e) => stem + e);
    case 'futuro':
      return IT_FUT.map((e) => itFutStem(v) + e);
    case 'condizionale':
      return IT_COND.map((e) => itFutStem(v) + e);
    case 'congiuntivo':
      if (v.isc) return ['isca', 'isca', 'isca', 'iamo', 'iate', 'iscano'].map((e) => stem + e);
      return IT_END.congiuntivo[group].map((e) => itJoin(stem, e, group));
    case 'passato': {
      const pp = participle(v, 'it');
      // С essere причастие согласуется: sono andato, siamo andati.
      return v.aux === 'essere' ? IT_ESSERE.map((a, i) => `${a} ${i < 3 ? pp : pp.slice(0, -1) + 'i'}`) : IT_AVERE.map((a) => `${a} ${pp}`);
    }
  }
}

/** Причастие: hablado, comido; parlato, creduto, dormito — если не записано своё. */
export function participle(v: VerbData, lang: Lang): string {
  if (v.pp) return v.pp;
  if (lang === 'es') return v.inf.slice(0, -2) + (plain(v.inf.slice(-2)) === 'ar' ? 'ado' : 'ido');
  const group = v.inf.slice(-3);
  return v.inf.slice(0, -3) + (group === 'are' ? 'ato' : group === 'ere' ? 'uto' : 'ito');
}

/** Шесть форм глагола во времени, от «я» до «они». */
export function conjugate(v: VerbData, tense: Tense, lang: Lang): string[] {
  return lang === 'es' ? esForms(v, tense as EsTense) : itForms(v, tense as ItTense);
}

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

/** Женская форма passato с essere: sono andato → sono andata, siamo andati → siamo andate. */
function feminine(v: VerbData, tense: Tense, form: string): string[] {
  if (tense !== 'passato' || v.aux !== 'essere') return [];
  return [form.replace(/o$/, 'a').replace(/i$/, 'e')].filter((f) => f !== form);
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
  const task = (v: VerbData, tense: Tense, person: number): ForgeTask => {
    const answer = conjugate(v, tense, lang)[person];
    const forms = tenses.flatMap((t) => {
      const all = conjugate(v, t, lang);
      return persons.map((p) => ({ form: all[p], label: `${PERSONS[lang][p]} · ${TENSE_RU[t]}` }));
    });
    return { inf: v.inf, ru: v.ru, tense, person, answer, alt: feminine(v, tense, answer), forms };
  };
  const out: ForgeTask[] = [];
  const seen = new Set<string>();
  for (const id of due) {
    const c = parseVerbCard(id);
    const v = c && byInf.get(c.inf);
    if (!c || !v || !tenses.includes(c.tense) || !persons.includes(c.person) || out.length >= size) continue;
    out.push(task(v, c.tense, c.person));
    seen.add(id);
  }
  if (!tenses.length || !verbs.length) return out;
  for (let guard = 0; out.length < size && guard < size * 50; guard++) {
    const v = verbs[Math.floor(rng() * verbs.length)];
    const tense = tenses[Math.floor(rng() * tenses.length)];
    const person = persons[Math.floor(rng() * persons.length)];
    const id = verbCardId(v.inf, tense, person);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(task(v, tense, person));
  }
  return out;
}
