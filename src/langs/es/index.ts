import type { LangProfile } from '../types';
import { addDays, date, word } from '../util';
import { ES_VERBS } from './verbs';

// Женский род, но с артиклем el из-за ударного a- (el agua, el aula).
const STRESSED_A = new Set([
  'agua', 'aula', 'arma', 'área', 'alma', 'ala', 'ave', 'hambre', 'hacha', 'águila', 'ancla', 'asma',
  'hada', 'haba', 'acta', 'arpa', 'aguas', 'alta',
]);

/** Испанский курс: язык Испании (задача 12.7). */
export const ES: LangProfile = {
  id: 'es',
  released: true,
  name: 'Испанский',
  variety: 'Испанский курс — язык Испании: vosotros, «vale», «coche», «ordenador».',
  flag: '🇪🇸',
  adverb: 'по-испански',
  genitive: 'испанского',
  voices: ['es-ES'],
  voicePrefix: 'es',
  locale: 'es',
  db: 'eslacity',
  heroKey: 'eslacity.hero',
  reminderBase: 1000,
  voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Испанский (Испания)».',
  thanks: { es: '¡Muchas gracias! Eres un sol.', ru: 'Большое спасибо! Ты просто солнце.' },
  samples: {
    voice: '¡Hola! ¿Qué tal? Un café con leche, por favor.',
    hero: 'Buenos días. Busco el camino a la Bóveda.',
  },

  singular: ['el', 'la'],
  plural: ['los', 'las'],
  indefinite: ['un', 'una', 'unos', 'unas'],
  gender: true,
  articleIssue(gender, article, core) {
    const expected = gender === 'f' ? ['la', 'las'] : ['el', 'los'];
    const stressedA = gender === 'f' && article === 'el' && STRESSED_A.has(core.split(' ')[0]);
    return expected.includes(article) || stressedA ? null : `артикль "${article}" не совпадает с родом ${gender}`;
  },

  letters: 'áéíóúüñ',
  examKeys: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
  answerRules: [],
  reflexive: 'se',
  infinitiveEnd: 2,
  verbs: ES_VERBS,
  pairKinds: ['swap', 'stress'],
  festivals: [
    {
      id: 'sanfermin',
      title: 'Сан-Фермин',
      native: 'San Fermín',
      town: 'Памплона, 6–14 июля',
      host: 'restaurant',
      colors: ['#c8102e', '#ffffff'],
      icon: '🐂',
      medal: { title: 'Красный платок', text: 'Миссия Сан-Фермина в неделю праздника' },
      // Как в Памплоне.
      week: (year) => ({ start: date(year, 7, 6), end: date(year, 7, 14) }),
    },
    {
      id: 'tomatina',
      title: 'Ла Томатина',
      native: 'La Tomatina',
      town: 'Буньоль, последняя среда августа',
      host: 'market',
      colors: ['#e23b2a', '#f2c94c', '#3c8a3c'],
      icon: '🍅',
      medal: { title: 'Томатная битва', text: 'Миссия Ла Томатины в неделю праздника' },
      // Последняя среда августа и по три дня вокруг.
      week: (year) => {
        const last = date(year, 8, 31);
        const wed = addDays(last, -((last.getDay() - 3 + 7) % 7));
        return { start: addDays(wed, -3), end: addDays(wed, 3) };
      },
    },
  ],

  hero: { words: [['viajero', 'viajera']], article: ['El', 'La'], adjectives: [] },
  you: {
    ty: word('tú|te|ti|tu|tus|contigo'),
    formal: word('usted|ustedes|ud|uds'),
    plural: word('vosotros|vosotras|os|vuestro|vuestra|vuestros|vuestras'),
  },
  districts: {
    A1: 'Первые шаги',
    A2: 'Прошедшие времена, местоимения, сравнения',
    'B1.1': 'Будущее, условное наклонение, subjuntivo',
    'B1.2': 'Условные предложения, косвенная речь, se',
    B2: 'Сложные времена subjuntivo, согласование времён',
    C1: 'Оттенки смысла, выделение, перифразы, официальный стиль',
  },
};
