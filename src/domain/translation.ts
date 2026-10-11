import { LANGS, type Lang } from '../lang';
import { word } from '../langs/util';

/**
 * Правила перевода (задача 15.3, `docs/TRANSLATION.md`): перевод говорит с игроком так же, как оригинал. Если в
 * реплике или примере «tú» / «tu», в переводе «ты»; если «usted» / «Lei», в переводе «вы». Чистые функции: проверку
 * по всему контенту запускает `scripts/validate-content.ts`.
 */

/** «Ты» в переводе: местоимения и глаголы 2-го лица единственного числа (хочешь, видишь). */
const RU_TY = word('ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоего|твоей|твоему|твоим|твоих|твою|\\p{L}+[еёи]шь');
/** «Вы» в переводе: местоимения и глаголы на -ите, -йте, -ёте (хотите, скажите, идёте). */
const RU_VY = word('вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашей|вашему|вашим|ваших|вашу|\\p{L}{2,}(?:ите|йте|ёте)');

export type Address = 'ty' | 'vy' | null;

/** Как обращается перевод: только «ты», только «вы» или не понять (нет обращения или оба). */
export function ruAddress(ru: string): Address {
  const ty = RU_TY.test(ru);
  const vy = RU_VY.test(ru);
  return ty === vy ? null : ty ? 'ty' : 'vy';
}

/** Как обращается оригинал: «ты», вежливое «вы» или не понять. Множественное «вы» (vosotros, voi) — не понять. */
export function sourceAddress(text: string, lang: Lang): Address {
  // Обращение в оригинале: на «ты», вежливое и множественное «вы» (vosotros, voi — в переводе тоже «вы»). Профиль языка, `you`.
  const s = LANGS[lang].you;
  const ty = s.ty.test(text);
  const vy = s.formal.test(text);
  if (s.plural.test(text) || ty === vy) return null;
  return ty ? 'ty' : 'vy';
}

/** Расхождение обращения: оригинал на «ты», перевод на «вы», или наоборот. */
export function addressIssue(es: string, ru: string, lang: Lang): string | null {
  const src = sourceAddress(es, lang);
  const tr = ruAddress(ru);
  if (!src || !tr || src === tr) return null;
  return src === 'ty' ? 'в оригинале на «ты», в переводе на «вы»' : 'в оригинале на «вы», в переводе на «ты»';
}

/** Слова, которые без «ё» читаются неверно или неоднозначно хуже: в переводах «ё» пишется везде. */
const NO_YO = word('еще|ее|нее|все-таки|идет|придет|пойдем|найдет|живет|ждет|зовет|поймет', '');

/** Замечания к русскому тексту: кавычки «ёлочки» (внутри — „лапки“), «ё» в словах из списка. */
export function typographyIssues(ru: string): string[] {
  const out: string[] = [];
  if (ru.includes('"')) out.push('прямые кавычки: в переводе «ёлочки», внутри них „лапки“');
  if (ru.includes('”')) out.push('кавычки ” : в переводе «ёлочки», внутри них „лапки“');
  const m = ru.match(NO_YO);
  if (m) out.push(`«${m[0]}» без «ё»`);
  return out;
}

/** Есть ли в строке кириллица: русский текст, его и проверяем. */
const CYRILLIC = /[а-яё]/i;

/**
 * Обход файла контента: у каждого объекта с `es` и `ru` сверяется обращение (с женской формой `fem`, если есть),
 * у каждой русской строки — типографика. `where` — путь до объекта.
 */
export function translationIssues(data: unknown, lang: Lang): { where: string; msg: string }[] {
  const out: { where: string; msg: string }[] = [];
  // В `fem` пара es/ru неполная (только изменённые поля), её сверяют вместе с исходной: там pairs = false.
  const visit = (x: unknown, path: string, key: string, pairs = true) => {
    if (typeof x === 'string') {
      // Поле es — текст на изучаемом языке, кириллицы в нём не бывает; проверяем только русские строки.
      if (key !== 'es' && CYRILLIC.test(x)) for (const msg of typographyIssues(x)) out.push({ where: path, msg });
      return;
    }
    if (Array.isArray(x)) return x.forEach((v, i) => visit(v, `${path}[${i}]`, key, pairs));
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if (pairs && typeof o.es === 'string' && typeof o.ru === 'string') {
      const msg = addressIssue(o.es, o.ru, lang);
      if (msg) out.push({ where: path, msg: `${msg}: «${o.ru}»` });
      const fem = o.fem as { es?: string; ru?: string } | undefined;
      if (fem && (fem.es || fem.ru)) {
        const femMsg = addressIssue(fem.es ?? o.es, fem.ru ?? o.ru, lang);
        if (femMsg && femMsg !== msg) out.push({ where: `${path}.fem`, msg: `${femMsg}: «${fem.ru ?? o.ru}»` });
      }
    }
    for (const [k, v] of Object.entries(o)) visit(v, path ? `${path}.${k}` : k, k, pairs && k !== 'fem');
  };
  visit(data, '', '');
  return out;
}
