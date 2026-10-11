import type { Tense, VerbData, VerbProfile } from '../types';

/** Итальянское спряжение: правильные формы по окончаниям, у неправильных глаголов — записанные отличия. */

export type ItTense = 'presente' | 'passato' | 'imperfetto' | 'futuro' | 'condizionale' | 'congiuntivo';

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

/** Причастие: parlato, creduto, dormito — если не записано своё. */
function participle(v: VerbData): string {
  if (v.pp) return v.pp;
  const group = v.inf.slice(-3);
  return v.inf.slice(0, -3) + (group === 'are' ? 'ato' : group === 'ere' ? 'uto' : 'ito');
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
      const pp = participle(v);
      // С essere причастие согласуется: sono andato, siamo andati.
      return v.aux === 'essere' ? IT_ESSERE.map((a, i) => `${a} ${i < 3 ? pp : pp.slice(0, -1) + 'i'}`) : IT_AVERE.map((a) => `${a} ${pp}`);
    }
  }
}

export const IT_VERBS: VerbProfile = {
  tenses: [
    { id: 'presente', ru: 'настоящее', lesson: 'a1.12-presente-are' },
    { id: 'passato', ru: 'passato prossimo', lesson: 'a2.07-passato-prossimo-avere' },
    { id: 'imperfetto', ru: 'imperfetto', lesson: 'a2.12-imperfetto-formazione' },
    { id: 'futuro', ru: 'будущее', lesson: 'b11.01-futuro' },
    { id: 'condizionale', ru: 'condizionale', lesson: 'b11.04-condizionale' },
    { id: 'congiuntivo', ru: 'congiuntivo presente', lesson: 'b11.06-congiuntivo-formazione' },
  ],
  persons: ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro'],
  infinitive: /(are|ere|ire)$/,
  fields: ['isc', 'aux'],
  conjugate: (v, tense) => itForms(v, tense as ItTense),
  participle,
  // Женская форма passato с essere: sono andato → sono andata, siamo andati → siamo andate.
  feminine: (v, tense, form) => {
    if (tense !== 'passato' || v.aux !== 'essere') return [];
    return [form.replace(/o$/, 'a').replace(/i$/, 'e')].filter((f) => f !== form);
  },
};
