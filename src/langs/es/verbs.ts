import type { Tense, VerbData, VerbProfile } from '../types';
import { plain } from '../util';

/** Испанское спряжение: правильные формы по окончаниям, у неправильных глаголов — записанные отличия. */

export type EsTense = 'presente' | 'indefinido' | 'imperfecto' | 'perfecto' | 'futuro' | 'condicional' | 'subjuntivo';

const ES_END = {
  presente: { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] },
  indefinido: { ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'] },
  imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'] },
  subjuntivo: { ar: ['e', 'es', 'e', 'emos', 'éis', 'en'], er: ['a', 'as', 'a', 'amos', 'áis', 'an'], ir: ['a', 'as', 'a', 'amos', 'áis', 'an'] },
};
const ES_FUT = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const ES_COND = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
const ES_HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];

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

/** Причастие: hablado, comido — если не записано своё. */
function participle(v: VerbData): string {
  if (v.pp) return v.pp;
  return v.inf.slice(0, -2) + (plain(v.inf.slice(-2)) === 'ar' ? 'ado' : 'ido');
}

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
      return ES_HABER.map((h) => `${h} ${participle(v)}`);
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

export const ES_VERBS: VerbProfile = {
  tenses: [
    { id: 'presente', ru: 'настоящее', lesson: 'a1.11-presente-ar' },
    { id: 'indefinido', ru: 'прошедшее, indefinido', lesson: 'a2.23-indefinido-regular' },
    { id: 'imperfecto', ru: 'прошедшее, imperfecto', lesson: 'a2.27-imperfecto-formacion' },
    { id: 'perfecto', ru: 'pretérito perfecto', lesson: 'a2.20-perfecto-formacion' },
    { id: 'futuro', ru: 'будущее', lesson: 'b11.01-futuro' },
    { id: 'condicional', ru: 'условное', lesson: 'b11.04-condicional' },
    { id: 'subjuntivo', ru: 'presente de subjuntivo', lesson: 'b11.06-subjuntivo-formacion' },
  ],
  persons: ['yo', 'tú', 'él / ella', 'nosotros', 'vosotros', 'ellos'],
  infinitive: /(ar|er|ir|ír)$/,
  fields: ['ch'],
  conjugate: (v, tense) => esForms(v, tense as EsTense),
  participle,
};
