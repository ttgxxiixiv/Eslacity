import type { LangProfile } from '../types';
import { addDays, date } from '../util';
import { EN_VERBS } from './verbs';

/** Сокращения и полные формы (задача 17.1): ответ «don't» и «do not» — один и тот же. */
const CONTRACTIONS: [string, string][] = [
  ["don't", 'do not'], ["doesn't", 'does not'], ["didn't", 'did not'],
  ["isn't", 'is not'], ["aren't", 'are not'], ["wasn't", 'was not'], ["weren't", 'were not'],
  ["haven't", 'have not'], ["hasn't", 'has not'], ["hadn't", 'had not'],
  ["won't", 'will not'], ["wouldn't", 'would not'], ["can't", 'cannot'], ["couldn't", 'could not'],
  ["shouldn't", 'should not'], ["mustn't", 'must not'], ["needn't", 'need not'], ["shan't", 'shall not'],
  ["i'm", 'i am'], ["you're", 'you are'], ["we're", 'we are'], ["they're", 'they are'],
  ["i've", 'i have'], ["you've", 'you have'], ["we've", 'we have'], ["they've", 'they have'],
  ["i'll", 'i will'], ["you'll", 'you will'], ["he'll", 'he will'], ["she'll", 'she will'], ["it'll", 'it will'],
  ["we'll", 'we will'], ["they'll", 'they will'],
  // «'s» после местоимения — почти всегда is; «it's been» с has — редкость, её покрывает alt.
  ["he's", 'he is'], ["she's", 'she is'], ["it's", 'it is'], ["that's", 'that is'], ["there's", 'there is'],
  ["what's", 'what is'], ["where's", 'where is'], ["who's", 'who is'], ["here's", 'here is'], ["let's", 'let us'],
];

/** Британское и американское написание: курс британский, американское засчитывается. */
const SPELLING: [string, string][] = [
  ['colour', 'color'], ['favourite', 'favorite'], ['flavour', 'flavor'], ['honour', 'honor'], ['humour', 'humor'],
  ['labour', 'labor'], ['neighbour', 'neighbor'], ['neighbourhood', 'neighborhood'], ['behaviour', 'behavior'],
  ['harbour', 'harbor'], ['centre', 'center'], ['theatre', 'theater'], ['metre', 'meter'], ['litre', 'liter'],
  ['fibre', 'fiber'], ['travelling', 'traveling'], ['travelled', 'traveled'], ['traveller', 'traveler'],
  ['cancelled', 'canceled'], ['jewellery', 'jewelry'], ['grey', 'gray'], ['programme', 'program'],
  ['organise', 'organize'], ['organised', 'organized'], ['realise', 'realize'], ['realised', 'realized'],
  ['recognise', 'recognize'], ['apologise', 'apologize'], ['defence', 'defense'], ['licence', 'license'],
  ['catalogue', 'catalog'], ['dialogue', 'dialog'], ['analyse', 'analyze'], ['mum', 'mom'],
  ['aeroplane', 'airplane'], ['pyjamas', 'pajamas'], ['moustache', 'mustache'], ['plough', 'plow'],
  ['sceptical', 'skeptical'], ['enrol', 'enroll'], ['fulfil', 'fulfill'], ['cosy', 'cozy'], ['mould', 'mold'],
];

// «an» перед согласной буквой, но гласным звуком: an hour, an honest man.
const AN_BEFORE = /^(hour|honest|honou?r|heir)/;
// «a» перед гласной буквой, но согласным звуком: a university, a user, a euro, a one-way ticket.
const A_BEFORE = /^(uni(?![mn])|us[eu]|uti|eu|ewe|one\b|once\b|ufo|u-)/;

// Буквы, чьё название начинается с гласного звука: «эф», «эйч», «экс» — an F, an X-ray.
const LETTER_AN = /^[AEFHILMNORSX]/;

/** «a apple», «an book»: артикль не по первому звуку слова. Аббревиатуры (an MP) и числа не проверяются. */
function articleSound(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?<![\p{L}'])(a|an|A|An)\s+([\p{L}][\p{L}'-]*)/gu)) {
    const [, art, next] = m;
    if (next.length > 1 && next === next.toUpperCase()) continue;
    const w = next.toLowerCase();
    // Буква отдельно (X-ray, U-turn) читается своим названием: «экс» — an, «ю» — a.
    const letter = /^\p{Lu}(?:-|$)/u.test(next);
    const an = letter ? LETTER_AN.test(next) : AN_BEFORE.test(w) || (/^[aeiou]/.test(w) && !A_BEFORE.test(w));
    const want = an ? 'an' : 'a';
    if (art.toLowerCase() !== want) out.push(`«${art} ${next}»: перед «${next}» нужен артикль «${want}»`);
  }
  return out;
}

/** Английский курс: британский вариант (задача 17.1), открыт с 2.185.0. */
export const EN: LangProfile = {
  id: 'en',
  released: true,
  name: 'Английский',
  variety: 'Английский курс — британский вариант: «flat», «lift», «queue». Американское написание тоже засчитывается.',
  flag: '🇬🇧',
  adverb: 'по-английски',
  genitive: 'английского',
  voices: ['en-GB'],
  voicePrefix: 'en',
  locale: 'en',
  db: 'eslacity-en',
  heroKey: 'eslacity.hero.en',
  reminderBase: 3000,
  voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Английский (Великобритания)».',
  thanks: { es: "Thank you so much! You're a star.", ru: 'Огромное спасибо! Ты просто звезда.' },
  samples: {
    voice: 'Hello! How are you? A cup of tea, please.',
    hero: "Good morning. I'm looking for the way to the Vault.",
  },

  singular: ['the'],
  plural: ['the'],
  indefinite: ['a', 'an'],
  gender: false,
  textIssues: articleSound,

  letters: '',
  examKeys: [],
  answerRules: [[/(^|\s)can not(?=\s|$)/g, '$1cannot']],
  contractions: CONTRACTIONS,
  spelling: SPELLING,
  reflexive: '',
  infinitiveEnd: 2,
  verbs: EN_VERBS,
  // Ударение без знаков на письме: ударный слог заглавными (REcord / reCORD), произношение — через `say`.
  pairKinds: ['swap', 'caps'],
  festivals: [
    {
      id: 'bonfire',
      title: 'Ночь костров',
      native: 'Bonfire Night',
      town: 'вся Британия, 5 ноября',
      host: 'park',
      colors: ['#e8601c', '#1b1b2f', '#f2c94c'],
      icon: '🎆',
      medal: { title: 'Огни пятого ноября', text: 'Миссия Ночи костров в неделю праздника' },
      // Пятое ноября и по три дня вокруг: костры жгут и в ближайшие выходные.
      week: (year) => ({ start: date(year, 11, 2), end: date(year, 11, 8) }),
    },
    {
      id: 'carnival',
      title: 'Карнавал в Ноттинг-Хилле',
      native: 'Notting Hill Carnival',
      town: 'Лондон, последние выходные августа',
      host: 'clothes',
      colors: ['#009b3a', '#fed100', '#ce1126'],
      icon: '🥁',
      medal: { title: 'Стальной барабан', text: 'Миссия карнавала в неделю праздника' },
      // Воскресенье и банковский понедельник в конце августа, неделя — с четверга до среды.
      week: (year) => {
        const last = date(year, 8, 31);
        const monday = addDays(last, -((last.getDay() - 1 + 7) % 7));
        return { start: addDays(monday, -4), end: addDays(monday, 2) };
      },
    },
  ],

  // Обращение одно для путника и путницы: «traveller».
  hero: { words: [['traveller', 'traveller']], article: null, adjectives: [] },
  // «Ты» и «вы» в английском не различаются: перевод решает по смыслу, проверка молчит.
  you: { ty: /(?!)/, formal: /(?!)/, plural: /(?!)/ },
  districts: {
    A1: 'Первые шаги',
    A2: 'Past Simple, going to и will, модальные',
    'B1.1': 'Present Perfect и Past Simple, условные 0–2, пассив',
    'B1.2': 'Косвенная речь, относительные придаточные, герундий',
    B2: 'Условные третьего типа, модальные в прошедшем, инверсия',
    C1: 'Оттенки смысла, выделение, фразовые глаголы, официальный стиль',
  },
};
