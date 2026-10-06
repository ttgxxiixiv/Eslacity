import type { LocationId } from '../content/schema';

/**
 * Праздники (задача 10.5): тематическая неделя в городе. На неделю праздника над картой города висят флажки его цветов,
 * у здания хозяина — знак праздника, на главной — приглашение. Внутри: слова праздника (урок слов, карточки потом
 * повторяются как обычные), фразы и миссия хозяина. Миссия, пройденная в неделю праздника, даёт тайную медаль.
 * Контент — `src/content/<язык>/festivals/<id>.json`, «место» слов, фраз и миссии — `fest-<id>`.
 */

export type FestivalId = 'sanfermin' | 'tomatina' | 'ferragosto' | 'carnevale';

export interface Festival {
  id: FestivalId;
  lang: 'es' | 'it';
  /** Название по-русски и на языке курса. */
  title: string;
  native: string;
  /** Где празднуют на самом деле: для описания. */
  town: string;
  /** Здание хозяина в городе: его житель приглашает и ведёт миссию. */
  host: LocationId;
  /** Цвета флажков над картой города. */
  colors: string[];
  /** Знак праздника у здания хозяина и в приглашении. */
  icon: string;
  /** Тайная медаль за миссию праздника. */
  medal: { title: string; text: string };
}

export const FESTIVALS: Festival[] = [
  {
    id: 'sanfermin',
    lang: 'es',
    title: 'Сан-Фермин',
    native: 'San Fermín',
    town: 'Памплона, 6–14 июля',
    host: 'restaurant',
    colors: ['#c8102e', '#ffffff'],
    icon: '🐂',
    medal: { title: 'Красный платок', text: 'Миссия Сан-Фермина в неделю праздника' },
  },
  {
    id: 'tomatina',
    lang: 'es',
    title: 'Ла Томатина',
    native: 'La Tomatina',
    town: 'Буньоль, последняя среда августа',
    host: 'market',
    colors: ['#e23b2a', '#f2c94c', '#3c8a3c'],
    icon: '🍅',
    medal: { title: 'Томатная битва', text: 'Миссия Ла Томатины в неделю праздника' },
  },
  {
    id: 'ferragosto',
    lang: 'it',
    title: 'Феррагосто',
    native: 'Ferragosto',
    town: 'вся Италия, 15 августа',
    host: 'beach',
    colors: ['#009246', '#ffffff', '#ce2b37'],
    icon: '🎆',
    medal: { title: 'Августовский фейерверк', text: 'Миссия Феррагосто в неделю праздника' },
  },
  {
    id: 'carnevale',
    lang: 'it',
    title: 'Карнавал в Венеции',
    native: 'Carnevale di Venezia',
    town: 'Венеция, перед Великим постом',
    host: 'hotel',
    colors: ['#6b2fa0', '#d4a017', '#1f6fb2'],
    icon: '🎭',
    medal: { title: 'Венецианская маска', text: 'Миссия Карнавала в неделю праздника' },
  },
];

export const festivalPlace = (id: FestivalId) => `fest-${id}` as const;
/** Сложность миссии праздника — как у миссий главы II: праздник приходит к любому игроку. */
export const FESTIVAL_CHAPTER = 2;
export const festivalMissionId = (id: FestivalId) => `ms:fest-${id}.${FESTIVAL_CHAPTER}`;
export const isFestivalPlace = (place: string): boolean => place.startsWith('fest-');

/** Куда вернуться после урока или миссии: в место города, на страницу праздника, к Летописцу (свитки). */
export function placePath(place: string): string {
  if (isFestivalPlace(place)) return `/festival/${place.slice('fest-'.length)}`;
  if (/^scroll\d+$/.test(place)) return '/journey-map';
  return `/loc/${place}`;
}
/** `fest-sanfermin.toro`, `ph:fest-sanfermin.ole` → `sanfermin`; не праздник — undefined. */
export function festivalOf(id: string): FestivalId | undefined {
  const m = /^(?:ph:|ms:)?fest-([a-z]+)/.exec(id);
  return m ? (m[1] as FestivalId) : undefined;
}

const DAY = 86_400_000;
const date = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/** Пасха по григорианскому календарю (алгоритм Гаусса в форме «анонимного григорианского»). */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return date(year, month, day);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Неделя праздника в году: первый и последний день (включительно, по местному времени).
 * Сан-Фермин — 6–14 июля, как в Памплоне. Ла Томатина — последняя среда августа и по три дня вокруг.
 * Феррагосто — 15 августа и по три дня вокруг. Карнавал — шесть дней до Жирного вторника и он сам
 * (Жирный вторник — за 47 дней до Пасхи).
 */
export function festivalWeek(id: FestivalId, year: number): { start: Date; end: Date } {
  switch (id) {
    case 'sanfermin':
      return { start: date(year, 7, 6), end: date(year, 7, 14) };
    case 'tomatina': {
      const last = date(year, 8, 31);
      const wed = addDays(last, -((last.getDay() - 3 + 7) % 7));
      return { start: addDays(wed, -3), end: addDays(wed, 3) };
    }
    case 'ferragosto':
      return { start: date(year, 8, 12), end: date(year, 8, 18) };
    case 'carnevale': {
      const tuesday = addDays(easter(year), -47);
      return { start: addDays(tuesday, -6), end: tuesday };
    }
  }
}

/** Идёт ли неделя праздника в момент `now`. */
export function isFestivalOn(id: FestivalId, now: number): boolean {
  const { start, end } = festivalWeek(id, new Date(now).getFullYear());
  return now >= start.getTime() && now < end.getTime() + DAY;
}

/** Праздник, который идёт сейчас в городе этого языка. */
export function activeFestival(lang: 'es' | 'it', now: number): Festival | undefined {
  return FESTIVALS.find((f) => f.lang === lang && isFestivalOn(f.id, now));
}

/** Ближайшая неделя праздника: эта, если идёт или ещё впереди в этом году, иначе следующего года. */
export function nextFestivalWeek(id: FestivalId, now: number): { start: Date; end: Date } {
  const y = new Date(now).getFullYear();
  const w = festivalWeek(id, y);
  return now < w.end.getTime() + DAY ? w : festivalWeek(id, y + 1);
}

export const festivalsOf = (lang: 'es' | 'it') => FESTIVALS.filter((f) => f.lang === lang);

/** Праздники, чья миссия пройдена в неделю праздника: по записям миссий (`meta.missions`). */
export function festivalsDone(records: Record<string, { done?: number }>): FestivalId[] {
  return FESTIVALS.filter((f) => {
    const done = records[festivalMissionId(f.id)]?.done;
    return done !== undefined && isFestivalOn(f.id, done);
  }).map((f) => f.id);
}
