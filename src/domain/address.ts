/**
 * Обращение жителей к путнику. В репликах жители зовут героя «viajero» / «viaggiatore» (в переводе —
 * «путешественник», «путник»). Если игрок назвал путника, обращение заменяется именем, если путник — женщина
 * без имени, — женской формой. Меняются только обращения: «Sigue la voz, viajero.», «¡Viajero! ...»,
 * «¡El viajero!»; рассказ о «viajero del mapa» в третьем лице остаётся как есть. Контент не меняется:
 * без имени у путника-мужчины текст тот же.
 */
export type HeroGender = 'm' | 'f';
export interface HeroCall {
  name: string;
  gender: HeroGender;
}

/** Слова обращения: мужская и женская форма. С большой буквы — в начале фразы. */
const WORDS: Record<'es' | 'it' | 'ru', [string, string][]> = {
  es: [['viajero', 'viajera']],
  it: [['viaggiatore', 'viaggiatrice']],
  ru: [['путешественник', 'путешественница'], ['путник', 'путница']],
};

/** Артикль перед обращением-восклицанием «¡El viajero!»: мужской и женский. */
/** Как жители зовут путника без имени: для подсказки в настройках. */
export const HERO_WORD = {
  es: { m: WORDS.es[0][0], f: WORDS.es[0][1] },
  it: { m: WORDS.it[0][0], f: WORDS.it[0][1] },
};

const ARTICLE: Record<'es' | 'it' | 'ru', [string, string] | null> = {
  es: ['El', 'La'],
  it: ['Il', 'La'],
  ru: null,
};

/** Итальянские прилагательные перед обращением согласуются с родом: «Tranquilla, viaggiatrice». */
const IT_ADJ: [string, string][] = [['Tranquillo', 'Tranquilla'], ['Attento', 'Attenta'], ['Caro', 'Cara']];

export const NAME_MAX = 16;

/**
 * Имя путника: латиница с ударениями, пробел, дефис, апостроф; каждое слово с заглавной. Жители произносят его
 * голосом своего языка, поэтому кириллица не подходит. Пустая строка — имени нет.
 */
export function cleanName(raw: string): string {
  const s = raw
    .normalize('NFC')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return s.replace(/(^|[ -])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Текст реплики с обращением к путнику по имени или в его роде. lang — язык текста (перевод — `ru`). */
export function addressHero(text: string, lang: 'es' | 'it' | 'ru', hero: HeroCall): string {
  const name = cleanName(hero.name);
  if (!name && hero.gender === 'm') return text;
  let out = text;
  for (const [m, f] of WORDS[lang]) {
    const low = name || f;
    const up = name || cap(f);
    // Начало фразы: «¡El viajero!», «Il viaggiatore!» — восклицание при встрече.
    const art = ARTICLE[lang];
    if (art) {
      out = out.replace(new RegExp(`(^|[.!?…»]\\s+)(¡?)${art[0]} ${m}!`, 'g'), (_, pre, mark) => `${pre}${mark}${name || `${art[1]} ${f}`}!`);
    }
    // «¡Viajero! ...», «Viaggiatore, ...», «Путник, вы ...» — обращение в начале фразы.
    out = out.replace(new RegExp(`(^|[.!?…»]\\s+)(¡?)${cap(m)}(?=[!,])`, 'gu'), (_, pre, mark) => `${pre}${mark}${up}`);
    // «..., viajero.», «А, путешественник!» — обращение после запятой.
    out = out.replace(new RegExp(`, ${m}(?=[.!?,:;…»]|$)`, 'gu'), `, ${low}`);
  }
  if (lang === 'it' && hero.gender === 'f') {
    const f = name || WORDS.it[0][1];
    for (const [adjM, adjF] of IT_ADJ) out = out.replaceAll(`${adjM}, ${f}`, `${adjF}, ${f}`);
  }
  return out;
}
