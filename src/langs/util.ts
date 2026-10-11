/** Общие помощники профилей языков. */

/** Слова целиком: `word('tú|te')` не найдёт «te» внутри «tener». */
export const word = (alts: string, flags = 'i') => new RegExp(`(?<![\\p{L}])(?:${alts})(?![\\p{L}])`, `u${flags}`);

/** Без знаков над буквами: для групп глагола (oír → ir). */
export const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export const date = (y: number, m: number, d: number) => new Date(y, m - 1, d);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

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
