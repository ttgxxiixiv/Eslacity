import type { Tense, VerbData, VerbProfile } from '../types';

/**
 * Английские формы: -s, -ed, -ing по правилам написания, у неправильных глаголов записаны прошедшее (`past`)
 * и причастие (`pp`), у двусложных с ударением на конце — удвоение согласной (`dbl`: prefer → preferred).
 */

export type EnTense = 'present-simple' | 'present-continuous' | 'past-simple' | 'present-perfect';

const VOWEL = /[aeiou]/;
const CONS = /[b-df-hj-np-tv-z]/;

/** Односложное «согласная — гласная — согласная» (stop, plan), кроме w, x, y на конце: согласная удваивается. */
function doubles(v: VerbData): boolean {
  if (v.dbl) return true;
  const w = v.inf;
  const vowels = w.match(/[aeiou]+/g) ?? [];
  if (vowels.length !== 1) return false;
  const n = w.length;
  return n >= 3 && CONS.test(w[n - 1]) && !/[wxy]/.test(w[n - 1]) && VOWEL.test(w[n - 2]) && CONS.test(w[n - 3]);
}

/** He / she: works, goes, watches, studies, plays. */
export function thirdPerson(inf: string): string {
  if (/(s|sh|ch|x|z|o)$/.test(inf)) return inf + 'es';
  if (/[^aeiou]y$/.test(inf)) return inf.slice(0, -1) + 'ies';
  return inf + 's';
}

/** Правильное прошедшее: worked, lived, studied, stopped, played. */
function regularPast(v: VerbData): string {
  const w = v.inf;
  if (w.endsWith('e')) return w + 'd';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
  if (doubles(v)) return w + w[w.length - 1] + 'ed';
  return w + 'ed';
}

/** -ing: making, lying, stopping, seeing, being. */
export function ingForm(v: VerbData): string {
  const w = v.inf;
  if (w.endsWith('ie')) return w.slice(0, -2) + 'ying';
  if (/[^aeiou]e$/.test(w) && w !== 'be') return w.slice(0, -1) + 'ing';
  if (doubles(v)) return w + w[w.length - 1] + 'ing';
  return w + 'ing';
}

const past = (v: VerbData) => v.past ?? regularPast(v);
const participle = (v: VerbData) => v.pp ?? v.past ?? regularPast(v);
const BE = ['am', 'are', 'is', 'are', 'are', 'are'];
const HAVE = ['have', 'have', 'has', 'have', 'have', 'have'];

function enForms(v: VerbData, tense: EnTense): string[] {
  const own = v.forms?.[tense as Tense];
  if (own) return own;
  switch (tense) {
    case 'present-simple':
      return [0, 1, 2, 3, 4, 5].map((i) => (i === 2 ? thirdPerson(v.inf) : v.inf));
    case 'present-continuous':
      return BE.map((b) => `${b} ${ingForm(v)}`);
    case 'past-simple':
      return Array(6).fill(past(v));
    case 'present-perfect':
      return HAVE.map((h) => `${h} ${participle(v)}`);
  }
}

export const EN_VERBS: VerbProfile = {
  // Уроки грамматики появятся в 17.4: id уроков открытия — по плану района A1–A2.
  tenses: [
    { id: 'present-simple', ru: 'Present Simple', lesson: 'a1.10-present-simple' },
    { id: 'present-continuous', ru: 'Present Continuous', lesson: 'a1.14-present-continuous' },
    { id: 'past-simple', ru: 'Past Simple', lesson: 'a2.04-past-simple' },
    { id: 'present-perfect', ru: 'Present Perfect', lesson: 'a2.20-present-perfect' },
  ],
  persons: ['I', 'you', 'he / she', 'we', 'you (мн.)', 'they'],
  infinitive: /^[a-z]+$/,
  fields: ['past', 'dbl'],
  conjugate: (v, tense) => enForms(v, tense as EnTense),
  participle,
};
