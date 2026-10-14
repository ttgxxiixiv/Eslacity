import type { Tense, VerbData, VerbProfile } from '../types';
import { conjugate, verbOf, type TrTense } from './morph';

/**
 * Турецкая кузница (задача 18.1): формы строит генератор по гармонии гласных и озвончению (`morph.ts`).
 * У глагола записываются только отличия от правил: `soft` — основа озвончается перед гласной (git → gidiyor),
 * `aorist` — гласная широкого времени не по правилу. Особые формы, если понадобятся, — строкой времени в `forms`.
 */

export type { TrTense } from './morph';

const verb = (v: VerbData) => verbOf(v.inf, { soft: v.soft, aorist: v.aorist })!;

export const TR_VERBS: VerbProfile = {
  // Время открывает его урок (план районов — задачи 18.4 и 18.6, уроки пишутся там).
  tenses: [
    { id: 'iyor', ru: 'настоящее на -iyor', lesson: 'a1.14-iyor' },
    { id: 'di', ru: 'прошедшее на -di', lesson: 'a1.20-di' },
    { id: 'ecek', ru: 'будущее на -ecek', lesson: 'a2.03-ecek' },
    { id: 'ir', ru: 'широкое время на -ir / -er', lesson: 'a2.10-genis-zaman' },
    { id: 'mis', ru: 'прошедшее пересказа на -miş', lesson: 'b11.01-mis' },
  ],
  persons: ['ben', 'sen', 'o', 'biz', 'siz', 'onlar'],
  infinitive: /^[a-zçğıöşüâîû]+m[ea]k$/,
  fields: ['soft', 'aorist'],
  conjugate: (v, tense) => v.forms?.[tense as Tense] ?? conjugate(verb(v), tense as TrTense),
  // Причастия как отдельной формы в кузнице нет: -miş — время. Для подписей берётся форма 3-го лица.
  participle: (v) => conjugate(verb(v), 'mis')[2],
};
