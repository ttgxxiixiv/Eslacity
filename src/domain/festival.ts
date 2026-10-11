import { LANGS, type Lang } from '../lang';
import type { FestivalDef } from '../langs/types';

export { easter } from '../langs/util';

/**
 * Праздники (задача 10.5): тематическая неделя в городе. На неделю праздника над картой города висят флажки его цветов,
 * у здания хозяина — знак праздника, на главной — приглашение. Внутри: слова праздника (урок слов, карточки потом
 * повторяются как обычные), фразы и миссия хозяина. Миссия, пройденная в неделю праздника, даёт тайную медаль.
 * Контент — `src/content/<язык>/festivals/<id>.json`, «место» слов, фраз и миссии — `fest-<id>`.
 */

export type FestivalId = string;

/** Праздник с языком курса. Описание и неделя — в профиле языка (`festivals` в `src/langs/<язык>/`). */
export interface Festival extends FestivalDef {
  lang: Lang;
}

export const FESTIVALS: Festival[] = Object.values(LANGS).flatMap((p) => p.festivals.map((f) => ({ ...f, lang: p.id })));

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

/** Неделя праздника в году: первый и последний день (включительно, по местному времени). Правило — в профиле языка. */
export function festivalWeek(id: FestivalId, year: number): { start: Date; end: Date } {
  const f = FESTIVALS.find((x) => x.id === id);
  if (!f) throw new Error(`нет праздника ${id}`);
  return f.week(year);
}

/** Идёт ли неделя праздника в момент `now`. */
export function isFestivalOn(id: FestivalId, now: number): boolean {
  const { start, end } = festivalWeek(id, new Date(now).getFullYear());
  return now >= start.getTime() && now < end.getTime() + DAY;
}

/** Праздник, который идёт сейчас в городе этого языка. */
export function activeFestival(lang: Lang, now: number): Festival | undefined {
  return FESTIVALS.find((f) => f.lang === lang && isFestivalOn(f.id, now));
}

/** Ближайшая неделя праздника: эта, если идёт или ещё впереди в этом году, иначе следующего года. */
export function nextFestivalWeek(id: FestivalId, now: number): { start: Date; end: Date } {
  const y = new Date(now).getFullYear();
  const w = festivalWeek(id, y);
  return now < w.end.getTime() + DAY ? w : festivalWeek(id, y + 1);
}

export const festivalsOf = (lang: Lang) => FESTIVALS.filter((f) => f.lang === lang);

/** Праздники, чья миссия пройдена в неделю праздника: по записям миссий (`meta.missions`). */
export function festivalsDone(records: Record<string, { done?: number }>): FestivalId[] {
  return FESTIVALS.filter((f) => {
    const done = records[festivalMissionId(f.id)]?.done;
    return done !== undefined && isFestivalOn(f.id, done);
  }).map((f) => f.id);
}
