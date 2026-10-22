/**
 * Имя и описание приложения для манифеста PWA и `<meta name="description">` (задача 20.1). Описание собирается
 * из открытых курсов, поэтому новый язык попадает в него сам, когда в профиле становится `released: true`.
 */
export const APP_NAME = 'Eslacity — языки в городе';

/** «Испанский, итальянский и английский для русскоговорящих: …» по названиям открытых курсов в порядке профилей. */
export function appDescription(names: string[]): string {
  const list = names.map((n, i) => (i === 0 ? n : n.toLowerCase()));
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} и ${list.at(-1)}` : (list[0] ?? '');
  return `${joined} для русскоговорящих: строй город, учи слова и грамматику`;
}
