import type { LangProfile } from '../types';
import { word } from '../util';
import { PT_VERBS } from './verbs';

/**
 * Слияния предлога с артиклем, которые в португальском обязательны: «de o» пишется do, «em a» — na, «por os» — pelos,
 * «a a» — à. Раздельное написание в тексте курса — ошибка (кроме редкого «de o» перед инфинитивом, его в курсе нет).
 * С неопределённым артиклем слияние необязательно: в бразильском письме обычны и «de uma», «em um», и «numa».
 */
const MERGE: [RegExp, (art: string) => string][] = [
  [/\bde (o|a|os|as)\b/giu, (a) => 'd' + a],
  [/\bem (o|a|os|as)\b/giu, (a) => 'n' + a],
  [/\bpor (o|a|os|as)\b/giu, (a) => 'pel' + a],
  [/(?<![\p{L}])a (o|os)\b/giu, (a) => 'a' + a],
  [/(?<![\p{L}])a (a|as)\b/giu, (a) => 'à' + a.slice(1)],
];

function mergeIssues(text: string): string[] {
  const out: string[] = [];
  for (const [re, fix] of MERGE) {
    for (const m of text.matchAll(re)) out.push(`«${m[0]}» пишется слитно: «${fix(m[1].toLowerCase())}»`);
  }
  return out;
}

/**
 * Португальский курс (задача 19.1): бразильский вариант, голос pt-BR. Закрыт до 19.9: город, слова и уроки
 * пишутся в 19.2–19.8. Обращение — você (на «ты») и o senhor / a senhora (на «вы»), tu и vós курс не учит;
 * европейского варианта нет. Артикли o, a, os, as; предлоги сливаются с артиклем (do, na, pelo, ao, à),
 * раздельное написание ловит `textIssues`.
 */
export const PT: LangProfile = {
  id: 'pt',
  released: false,
  name: 'Португальский',
  variety: 'Португальский курс — бразильский вариант: você и o senhor, «ônibus», «trem», «celular».',
  flag: '🇧🇷',
  adverb: 'по-португальски',
  genitive: 'португальского',
  voices: ['pt-BR'],
  voicePrefix: 'pt',
  locale: 'pt',
  db: 'eslacity-pt',
  heroKey: 'eslacity.hero.pt',
  reminderBase: 5000,
  voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Португальский (Бразилия)».',
  thanks: { es: 'Valeu! Você é demais.', ru: 'Спасибо! Ты просто чудо.' },
  samples: {
    voice: 'Olá! Tudo bem? Um cafezinho, por favor.',
    hero: 'Bom dia. Estou procurando o caminho para o Cofre.',
  },

  singular: ['o', 'a'],
  plural: ['os', 'as'],
  indefinite: ['um', 'uma', 'uns', 'umas'],
  gender: true,
  articleIssue(gender, article) {
    const expected = gender === 'f' ? ['a', 'as'] : ['o', 'os'];
    return expected.includes(article) ? null : `артикль "${article}" не совпадает с родом ${gender}`;
  },

  letters: 'áâãàçéêíóôõú',
  examKeys: ['á', 'â', 'ã', 'à', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'],
  answerRules: [],
  textIssues: mergeIssues,
  // Возвратный глагол в словаре пишется через дефис: lavar-se, sentar-se.
  reflexive: '-se',
  infinitiveEnd: 2,
  verbs: PT_VERBS,
  // pão / pau (носовые, swap), avó / avô и país / pais (знак над буквой, stress), caro / carro (double).
  pairKinds: ['swap', 'stress', 'double'],
  // Festa Junina и Carnaval — в 19.9.
  festivals: [],

  // «Viajante» одного вида для путника и путницы, род виден по артиклю: o viajante, a viajante.
  hero: { words: [['viajante', 'viajante']], article: ['O', 'A'], adjectives: [] },
  // Бразильское você — обращение на «ты»; o senhor / a senhora — на «вы»; vocês — «вы» многим.
  you: {
    ty: word('você|te|ti|contigo|tu|teu|tua|teus|tuas'),
    formal: word('o senhor|a senhora|os senhores|as senhoras|do senhor|da senhora|ao senhor|à senhora'),
    plural: word('vocês|vós|vos|vosso|vossa'),
  },
  districts: {
    A1: 'Первые шаги',
    A2: 'Прошедшие времена, местоимения, futuro com ir',
    'B1.1': 'Subjuntivo, личный инфинитив, будущее сослагательного',
    'B1.2': 'Условные предложения, косвенная речь, пассив',
    B2: 'Сложные времена subjuntivo, согласование времён',
    C1: 'Оттенки смысла, выделение, перифразы, официальный стиль',
  },
};
