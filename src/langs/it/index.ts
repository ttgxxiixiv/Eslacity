import type { LangProfile } from '../types';
import { addDays, date, easter, word } from '../util';
import { IT_VERBS } from './verbs';

// lo/gli перед s+согласная, z, gn, ps, x, y; l' перед гласной.
// Перед h (заимствования) бывает и так и так: la hostess, l'home banking.
const IT_LO = /^(s[^aeiouàèéìòù]|z|gn|ps|x|y)/;
const IT_VOWEL = /^[aeiouàèéìòù]/;

/** Итальянский курс: общий литературный итальянский. */
export const IT: LangProfile = {
  id: 'it',
  name: 'Итальянский',
  variety: 'Итальянский курс — общий литературный итальянский.',
  flag: '🇮🇹',
  adverb: 'по-итальянски',
  genitive: 'итальянского',
  voices: ['it-IT'],
  voicePrefix: 'it',
  locale: 'it',
  db: 'eslacity-it',
  heroKey: 'eslacity.hero.it',
  reminderBase: 2000,
  voiceHint: 'Android: Настройки → Синтез речи → Google → установить голос «Итальянский (Италия)».',
  thanks: { es: 'Grazie mille! Sei un tesoro.', ru: 'Огромное спасибо! Ты просто сокровище.' },
  samples: {
    voice: 'Ciao! Come stai? Un caffè, per favore.',
    hero: 'Buongiorno. Cerco la strada per il Caveau.',
  },

  singular: ['il', 'lo', 'la', "l'"],
  plural: ['i', 'gli', 'le'],
  indefinite: ['un', 'uno', 'una', "un'"],
  gender: true,
  articleIssue(gender, article, core) {
    const expected = gender === 'f' ? ['la', "l'", 'le'] : ['il', 'lo', "l'", 'i', 'gli'];
    if (!expected.includes(article)) return `артикль "${article}" не совпадает с родом ${gender}`;
    if (core.startsWith('h')) return null;
    const vowel = IT_VOWEL.test(core);
    const lo = IT_LO.test(core);
    let want: string | null = null;
    if (article === "l'" && !vowel) want = gender === 'f' ? 'la' : lo ? 'lo' : 'il';
    if ((article === 'il' || article === 'lo' || article === 'la') && vowel) want = "l'";
    if (article === 'il' && lo) want = 'lo';
    if (article === 'lo' && !lo && !vowel) want = 'il';
    if (article === 'i' && (vowel || lo)) want = 'gli';
    if (article === 'gli' && !vowel && !lo) want = 'i';
    return want ? `перед "${core}" нужен артикль "${want}", а не "${article}"` : null;
  },

  letters: 'àèéìòù',
  examKeys: ['à', 'è', 'é', 'ì', 'ò', 'ù', "'"],
  // «l' acqua» → «l'acqua», но «un po' di» не трогаем.
  answerRules: [[/(^|\s)(l|un|dell|all|dall|nell|sull|coll|quest|quell|c|d|m|t|s|v)'\s+/g, "$1$2'"]],
  reflexive: 'si',
  infinitiveEnd: 3,
  verbs: IT_VERBS,
  pairKinds: ['swap', 'stress', 'double'],
  festivals: [
    {
      id: 'ferragosto',
      title: 'Феррагосто',
      native: 'Ferragosto',
      town: 'вся Италия, 15 августа',
      host: 'beach',
      colors: ['#009246', '#ffffff', '#ce2b37'],
      icon: '🎆',
      medal: { title: 'Августовский фейерверк', text: 'Миссия Феррагосто в неделю праздника' },
      // 15 августа и по три дня вокруг.
      week: (year) => ({ start: date(year, 8, 12), end: date(year, 8, 18) }),
    },
    {
      id: 'carnevale',
      title: 'Карнавал в Венеции',
      native: 'Carnevale di Venezia',
      town: 'Венеция, перед Великим постом',
      host: 'hotel',
      colors: ['#6b2fa0', '#d4a017', '#1f6fb2'],
      icon: '🎭',
      medal: { title: 'Венецианская маска', text: 'Миссия Карнавала в неделю праздника' },
      // Шесть дней до Жирного вторника и он сам (Жирный вторник — за 47 дней до Пасхи).
      week: (year) => {
        const tuesday = addDays(easter(year), -47);
        return { start: addDays(tuesday, -6), end: tuesday };
      },
    },
  ],

  // «Viandante» у Сфинкса: одно слово для обоих родов.
  hero: {
    words: [['viaggiatore', 'viaggiatrice'], ['viandante', 'viandante']],
    article: ['Il', 'La'],
    adjectives: [['Tranquillo', 'Tranquilla'], ['Attento', 'Attenta'], ['Caro', 'Cara']],
  },
  you: {
    ty: word('tu|ti|te|tuo|tua|tuoi|tue|teco'),
    // Вежливое «Lei» пишется с заглавной; в начале предложения оно неотличимо от «lei» («она»), поэтому только в середине.
    formal: /(?<=[\p{L},] )(?:Lei|La|Le|Suo|Sua|Suoi|Sue|Glielo|Gliela)(?![\p{L}])/u,
    plural: word('voi|vi|vostro|vostra|vostri|vostre'),
  },
  districts: {
    A1: 'Первые шаги',
    A2: 'Passato prossimo, imperfetto, местоимения',
    'B1.1': 'Будущее, condizionale, congiuntivo',
    'B1.2': 'Условные предложения, косвенная речь, si',
    B2: 'Congiuntivo imperfetto и trapassato, согласование времён',
    C1: 'Оттенки смысла, выделение, редкие формы, официальный стиль',
  },
};
