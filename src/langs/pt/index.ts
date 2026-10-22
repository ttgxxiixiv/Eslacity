import type { LangProfile } from '../types';
import { addDays, date, easter, word } from '../util';
import { PT_VERBS } from './verbs';

/**
 * Слияния предлога с артиклем, которые в португальском обязательны: «de o» пишется do, «em a» — na, «por os» — pelos,
 * «a a» — à. Раздельное написание в тексте курса — ошибка (кроме редкого «de o» перед инфинитивом, его в курсе нет).
 * С неопределённым артиклем слияние необязательно: в бразильском письме обычны и «de uma», «em um», и «numa».
 */
// Границы слова — через \p{L}, а не \b: \b знает только латиницу без знаков, и «de açúcar» читалось бы как «de a».
const MERGE: [RegExp, (art: string) => string][] = [
  [/(?<!\p{L})de (o|a|os|as)(?!\p{L})/giu, (a) => 'd' + a],
  [/(?<!\p{L})em (o|a|os|as)(?!\p{L})/giu, (a) => 'n' + a],
  [/(?<!\p{L})por (o|a|os|as)(?!\p{L})/giu, (a) => 'pel' + a],
  [/(?<!\p{L})a (o|os)(?!\p{L})/giu, (a) => 'a' + a],
  [/(?<!\p{L})a (a|as)(?!\p{L})/giu, (a) => 'à' + a.slice(1)],
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
  released: true,
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
  festivals: [
    {
      id: 'junina',
      title: 'Праздник июня',
      native: 'Festa Junina',
      town: 'вся Бразилия, ночь с 23 на 24 июня',
      host: 'park',
      colors: ['#e53935', '#fdd835', '#1e88e5', '#43a047'],
      icon: '🔥',
      medal: { title: 'Июньский костёр', text: 'Миссия Праздника июня в неделю праздника' },
      // Иванова ночь с 23 на 24 июня и дни вокруг неё.
      week: (year) => ({ start: date(year, 6, 20), end: date(year, 6, 26) }),
    },
    {
      id: 'carnaval',
      title: 'Бразильский карнавал',
      native: 'Carnaval',
      town: 'вся Бразилия, перед Великим постом',
      host: 'beach',
      colors: ['#009c3b', '#ffdf00', '#002776'],
      icon: '🎊',
      medal: { title: 'Зонтик фрево', text: 'Миссия Карнавала в неделю праздника' },
      // Шесть дней до Жирного вторника и он сам (Жирный вторник — за 47 дней до Пасхи).
      week: (year) => {
        const tuesday = addDays(easter(year), -47);
        return { start: addDays(tuesday, -6), end: tuesday };
      },
    },
  ],

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
