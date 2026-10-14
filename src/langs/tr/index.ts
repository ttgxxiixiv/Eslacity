import type { LangProfile } from '../types';
import { word } from '../util';
import { analyze } from './morph';
import { TR_VERBS } from './verbs';

/** Строчные по-турецки: I → ı, İ → i (иначе «Irmak» стал бы «irmak», а «İzmir» — «i̇zmir» с точкой сверху). */
const lower = (s: string) => s.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();

// Окончания 2-го лица глагола, по которым видно «ты» и «вы» в оригинале. Короткие (-din, -sin) не берутся:
// «kadın» — не «ты пришёл», «versin» — повелительное 3-го лица.
const TY_VERB = '\\p{L}{2,}(?:yorsun|acaksın|eceksin|mışsın|mişsin|muşsun|müşsün|malısın|melisin)';
const SIZ_VERB = '\\p{L}{2,}(?:yorsunuz|acaksınız|eceksiniz|mışsınız|mişsiniz|muşsunuz|müşsünüz|malısınız|melisiniz)';

/**
 * Турецкий курс (задача 18.1): стамбульский литературный язык, голос tr-TR. Закрыт до 18.9: город, слова
 * и уроки пишутся в 18.2–18.8. Рода и артиклей нет (bir — числительное «один» и неопределённость, в слово
 * не входит), слово строится цепочкой аффиксов по гармонии гласных (`morph.ts`).
 */
export const TR: LangProfile = {
  id: 'tr',
  released: false,
  name: 'Турецкий',
  variety: 'Турецкий курс — стамбульский литературный язык: обращение на sen и на siz, kolay gelsin, afiyet olsun.',
  flag: '🇹🇷',
  adverb: 'по-турецки',
  genitive: 'турецкого',
  voices: ['tr-TR'],
  voicePrefix: 'tr',
  locale: 'tr',
  db: 'eslacity-tr',
  heroKey: 'eslacity.hero.tr',
  reminderBase: 4000,
  voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Турецкий».',
  thanks: { es: 'Çok teşekkür ederim! Eline sağlık.', ru: 'Большое спасибо! Золотые у тебя руки.' },
  samples: {
    voice: 'Merhaba! Nasılsınız? Bir çay, lütfen.',
    hero: 'Günaydın. Mahzen’e giden yolu arıyorum.',
  },

  singular: [],
  plural: [],
  indefinite: [],
  gender: false,

  letters: 'çğöşüâîû',
  distinct: 'ıİ',
  examKeys: ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'],
  lower,
  answerRules: [],
  reflexive: '',
  infinitiveEnd: 3,
  verbs: TR_VERBS,
  analyze,
  // ı/i, o/ö (swap), долгота с циркумфлексом hala/hâlâ (stress — знак над буквой), eli/elli (double).
  pairKinds: ['swap', 'stress', 'double'],
  // Hıdrellez и 23 Nisan — в 18.9.
  festivals: [],

  // Обращение «yolcu» одно для путника и путницы; женская форма нужна только в русском переводе.
  hero: { words: [['yolcu', 'yolcu']], article: null, adjectives: [] },
  // «Ты» — sen и его формы, «вы» — siz (и вежливое, и множественное, как русское «вы»).
  you: {
    ty: new RegExp(`${word('sen|seni|sana|sende|senden|senin|seninle|sence').source}|${TY_VERB}(?![\\p{L}])`, 'iu'),
    formal: new RegExp(`${word('siz|sizi|size|sizde|sizden|sizin|sizinle|sizce').source}|${SIZ_VERB}(?![\\p{L}])`, 'iu'),
    plural: word('sizler|hepiniz'),
  },
  districts: {
    A1: 'Первые шаги: гармония гласных, падежи, -iyor',
    A2: 'Прошедшее -di, будущее -ecek, широкое время',
    'B1.1': 'Пересказ -miş, причастия и деепричастия',
    'B1.2': 'Условное -sa, залоги, -mek için',
    B2: 'Косвенная речь, сложные времена, нереальное условие',
    C1: 'Регистр, порядок слов, книжные формы',
  },
};
