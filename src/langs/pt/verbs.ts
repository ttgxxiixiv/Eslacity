import type { Tense, VerbData, VerbProfile } from '../types';

/**
 * Португальское спряжение (задача 19.1): правильные формы по окончаниям, у неправильных глаголов — записанные
 * отличия (`forms`, `yo` — форма «eu» в настоящем, `fut` — основа будущего, `pp` — причастие). Генератор строит
 * все шесть традиционных лиц (eu, tu, ele, nós, vós, eles), а кузница даёт только бразильские: eu, você, nós, vocês
 * (tu и vós курс не учит, `used`). Личный инфинитив и будущее сослагательного — свои времена: их нет у испанского.
 */

export type PtTense = 'presente' | 'perfeito' | 'imperfeito' | 'futuro' | 'condicional' | 'subjuntivo' | 'infpessoal' | 'futsubj';

type Group = 'ar' | 'er' | 'ir';

const END: Record<'presente' | 'perfeito' | 'imperfeito' | 'subjuntivo', Record<Group, string[]>> = {
  presente: { ar: ['o', 'as', 'a', 'amos', 'ais', 'am'], er: ['o', 'es', 'e', 'emos', 'eis', 'em'], ir: ['o', 'es', 'e', 'imos', 'is', 'em'] },
  perfeito: { ar: ['ei', 'aste', 'ou', 'amos', 'astes', 'aram'], er: ['i', 'este', 'eu', 'emos', 'estes', 'eram'], ir: ['i', 'iste', 'iu', 'imos', 'istes', 'iram'] },
  imperfeito: { ar: ['ava', 'avas', 'ava', 'ávamos', 'áveis', 'avam'], er: ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'], ir: ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'] },
  subjuntivo: { ar: ['e', 'es', 'e', 'emos', 'eis', 'em'], er: ['a', 'as', 'a', 'amos', 'ais', 'am'], ir: ['a', 'as', 'a', 'amos', 'ais', 'am'] },
};
const FUT = ['ei', 'ás', 'á', 'emos', 'eis', 'ão'];
const COND = ['ia', 'ias', 'ia', 'íamos', 'íeis', 'iam'];
/** Окончания личного инфинитива и будущего сослагательного: к инфинитиву или к основе 3-го лица мн. ч. перфекта. */
const PERSONAL = ['', 'es', '', 'mos', 'des', 'em'];

/** Группа и основа: falar → ar, fal. У pôr (старое poer) все формы записаны, группа для подстраховки — er. */
function split(inf: string): { group: Group; stem: string } {
  const g = inf.slice(-2);
  return { group: g === 'ar' || g === 'ir' ? g : 'er', stem: inf.slice(0, -2) };
}

/** Перед e у глаголов на -ar: c → qu, g → gu, ç → c (fiquei, cheguei, comecei; fique, chegue, comece). */
const beforeE = (stem: string) => stem.replace(/c$/, 'qu').replace(/g$/, 'gu').replace(/ç$/, 'c');
/** Перед o и a у глаголов на -er и -ir: c → ç, g → j (conheço, conheça; elejo, eleja). */
const beforeOA = (stem: string) => stem.replace(/c$/, 'ç').replace(/g$/, 'j');

/** Причастие: falado, comido, partido — если не записано своё (feito, dito, visto). */
function participle(v: VerbData): string {
  if (v.pp) return v.pp;
  return v.inf.slice(0, -2) + (v.inf.endsWith('ar') ? 'ado' : 'ido');
}

function ptForms(v: VerbData, tense: PtTense): string[] {
  const own = v.forms?.[tense as Tense];
  if (own) return own;
  const { group, stem } = split(v.inf);
  switch (tense) {
    case 'presente': {
      const out = END.presente[group].map((e) => stem + e);
      out[0] = v.yo ?? (group === 'ar' ? stem : beforeOA(stem)) + 'o';
      return out;
    }
    case 'perfeito':
      return END.perfeito[group].map((e, i) => (i === 0 && group === 'ar' ? beforeE(stem) : stem) + e);
    case 'imperfeito':
      return END.imperfeito[group].map((e) => stem + e);
    case 'futuro':
      return FUT.map((e) => (v.fut ?? v.inf) + e);
    case 'condicional':
      return COND.map((e) => (v.fut ?? v.inf) + e);
    case 'subjuntivo': {
      // Основа — от формы «eu» настоящего: faço → faça, durmo → durma, peço → peça.
      const eu = ptForms(v, 'presente')[0];
      const base = eu.endsWith('o') ? eu.slice(0, -1) : stem;
      return END.subjuntivo[group].map((e) => (group === 'ar' ? beforeE(base) : base) + e);
    }
    case 'infpessoal':
      return PERSONAL.map((e) => v.inf + e);
    case 'futsubj': {
      // Основа — 3-е лицо мн. ч. перфекта без -am: falaram → falar, fizeram → fizer, foram → for.
      const base = ptForms(v, 'perfeito')[5].replace(/am$/, '');
      return PERSONAL.map((e) => base + e);
    }
  }
}

export const PT_VERBS: VerbProfile = {
  // Время открывает его урок (уроки пишутся в 19.4 и 19.6).
  tenses: [
    { id: 'presente', ru: 'настоящее', lesson: 'a1.11-presente-ar' },
    { id: 'perfeito', ru: 'прошедшее, pretérito perfeito', lesson: 'a2.20-perfeito-regular' },
    { id: 'imperfeito', ru: 'прошедшее, imperfeito', lesson: 'a2.27-imperfeito' },
    { id: 'futuro', ru: 'будущее', lesson: 'b11.01-futuro' },
    { id: 'condicional', ru: 'futuro do pretérito', lesson: 'b11.04-futuro-do-preterito' },
    { id: 'subjuntivo', ru: 'presente do subjuntivo', lesson: 'b11.06-subjuntivo-presente' },
    { id: 'infpessoal', ru: 'личный инфинитив', lesson: 'b11.10-infinitivo-pessoal' },
    { id: 'futsubj', ru: 'futuro do subjuntivo', lesson: 'b11.12-futuro-do-subjuntivo' },
  ],
  persons: ['eu', 'tu', 'você / ele / ela', 'nós', 'vós', 'vocês / eles / elas'],
  used: [0, 2, 3, 5],
  infinitive: /(ar|er|ir|ôr)$/,
  fields: [],
  conjugate: (v, tense) => ptForms(v, tense as PtTense),
  participle,
};
