/**
 * Турецкая морфология (задача 18.1): гармония гласных, озвончение на стыке, формы существительного и глагола
 * и разбор словоформы на возможные леммы. Чистые функции без данных курса: их берут профиль (кузница),
 * скрипты словаря (покрытие текстов разбором аффиксов) и тесты.
 *
 * Обозначения аффиксов: A — двухвариантная гармония (a/e), I — четырёхвариантная (ı/i/u/ü), D — d/t по
 * глухости предыдущего звука, (y), (n), (s) — соединительные согласные после гласной.
 */

const VOWELS = 'aeıioöuüâîû';
const FRONT = 'eiöüî';
const ROUND = 'oöuüû';
/** Глухие согласные: после них D становится t («fıstıkçı şahap»). */
const VOICELESS = 'fstkçşhp';

export const isVowel = (c: string | undefined) => !!c && VOWELS.includes(c);

/** Свойства слова, которые меняют стык (как в словаре Zemberek). */
export interface TrWord {
  /** Озвончение конечной p, ç, t, k перед гласной: kitap → kitabı, git → gidiyor. Без поля — по правилу. */
  soft?: boolean;
  /** Выпадение последней гласной основы: ağız → ağzı, burun → burnu. */
  drop?: boolean;
  /** Удвоение конечной согласной: hak → hakkı, his → hissi. */
  double?: boolean;
  /** Обратная гармония у заимствований: saat → saati, alkol → alkolü. */
  inverse?: boolean;
}

export interface TrVerb {
  /** Основа без -mek/-mak: gel, oku, git. */
  stem: string;
  /** Озвончение основы перед гласной: git → gidiyor, et → ediyor. */
  soft?: boolean;
  /** Гласная широкого времени у основы на согласную: gel → gelir (I), git → gider (A). Без поля — по правилу. */
  aorist?: 'I' | 'A';
}

/** Последняя гласная слова (или null): от неё зависит гармония аффикса. */
export function lastVowel(s: string): string | null {
  for (let i = s.length - 1; i >= 0; i--) if (isVowel(s[i])) return s[i];
  return null;
}

const flip: Record<string, string> = { a: 'e', ı: 'i', o: 'ö', u: 'ü', â: 'e' };
/** Гласная, по которой идёт гармония: последняя, у слов с обратной гармонией — её передний парный звук. */
function harmonyVowel(s: string, inverse = false): string {
  const v = lastVowel(s) ?? 'e';
  return inverse ? (flip[v] ?? v) : v;
}

/** Двухвариантная гармония: e после передних гласных, a после задних. */
export const A = (s: string, inverse = false) => (FRONT.includes(harmonyVowel(s, inverse)) ? 'e' : 'a');

/** Четырёхвариантная гармония: ı, i, u, ü по ряду и огублённости последней гласной. */
export function I(s: string, inverse = false): string {
  const v = harmonyVowel(s, inverse);
  const front = FRONT.includes(v);
  const round = ROUND.includes(v);
  return front ? (round ? 'ü' : 'i') : round ? 'u' : 'ı';
}

/** d или t в начале аффикса: после глухой согласной — t (kitapta, gitti). */
export const D = (s: string) => (VOICELESS.includes(s[s.length - 1]) ? 't' : 'd');

const syllables = (s: string) => [...s].filter(isVowel).length;

/** Озвончение конечной согласной перед гласной: p → b, ç → c, t → d, k → ğ (после n — g: renk → rengi). */
export function soften(s: string): string {
  const last = s[s.length - 1];
  if (last === 'k') return s.slice(0, -1) + (s[s.length - 2] === 'n' ? 'g' : 'ğ');
  const to: Record<string, string> = { p: 'b', ç: 'c', t: 'd' };
  return to[last] ? s.slice(0, -1) + to[last] : s;
}

/** Озвончается ли слово по умолчанию: многосложное на p, ç, t, k (kitap, ağaç, ekmek); односложное — нет (top). */
export const softByDefault = (s: string) => syllables(s) > 1 && /[pçtk]$/.test(s);

/** Основа существительного перед аффиксом на гласную: озвончение, выпадение гласной, удвоение. */
function nounBeforeVowel(stem: string, w: TrWord): string {
  if (isVowel(stem[stem.length - 1])) return stem;
  if (w.double) return stem + stem[stem.length - 1];
  if (w.drop) {
    const i = stem.length - 2;
    return stem.slice(0, i) + stem.slice(i + 1);
  }
  return (w.soft ?? softByDefault(stem)) ? soften(stem) : stem;
}

export type TrCase = 'nom' | 'acc' | 'dat' | 'loc' | 'abl' | 'gen' | 'ins';
/** Лица принадлежности: 1 — мой, 2 — твой, 3 — его, 4 — наш, 5 — ваш, 6 — их. */
export type TrPerson = 1 | 2 | 3 | 4 | 5 | 6;

/** Форма существительного: множественное, принадлежность, падеж. evler, evim, evimde, kitabı, kitaplarımızdan. */
export function noun(lemma: string, w: TrWord = {}, o: { plural?: boolean; poss?: TrPerson; case?: TrCase } = {}): string {
  let s = lemma;
  let inv = !!w.inverse;
  let changed = false;
  // Аффикс на гласную: основа меняется только у самого слова, не после -ler.
  const vowelSuffix = (suffix: (base: string) => string) => {
    const base = changed ? s : nounBeforeVowel(s, w);
    s = base + suffix(base);
    changed = true;
  };
  if (o.plural) {
    s += 'l' + A(s, inv) + 'r';
    changed = true;
    inv = false;
  }
  let third = false;
  if (o.poss) {
    const endsVowel = isVowel(s[s.length - 1]);
    if (o.poss === 6) {
      if (o.plural) {
        s += I(s, inv);
      } else {
        s += 'l' + A(s, inv) + 'r';
        s += I(s);
      }
      third = true;
    } else if (o.poss === 3) {
      if (endsVowel) s += 's' + I(s, inv);
      else vowelSuffix((b) => I(b, inv));
      third = true;
    } else {
      const tail: Record<number, (v: string, b: string) => string> = {
        1: () => 'm',
        2: () => 'n',
        4: (_v, b) => 'm' + I(b, inv) + 'z',
        5: (_v, b) => 'n' + I(b, inv) + 'z',
      };
      if (endsVowel) s += tail[o.poss]('', s);
      else vowelSuffix((b) => I(b, inv) + tail[o.poss!]('', b + I(b, inv)));
    }
    inv = false;
  }
  const c = o.case ?? 'nom';
  if (c === 'nom') return s;
  const endsVowel = isVowel(s[s.length - 1]);
  // После принадлежности 3-го лица — соединительное n: evini, evine, evinde, evinden.
  if (third) {
    const n: Record<Exclude<TrCase, 'nom'>, string> = {
      acc: 'n' + I(s),
      dat: 'n' + A(s),
      loc: 'nd' + A(s),
      abl: 'nd' + A(s) + 'n',
      gen: 'n' + I(s) + 'n',
      ins: 'yl' + A(s),
    };
    return s + n[c];
  }
  switch (c) {
    case 'acc':
      if (endsVowel) return s + 'y' + I(s, inv);
      vowelSuffix((b) => I(b, inv));
      return s;
    case 'dat':
      if (endsVowel) return s + 'y' + A(s, inv);
      vowelSuffix((b) => A(b, inv));
      return s;
    case 'gen':
      if (endsVowel) return s + 'n' + I(s, inv) + 'n';
      vowelSuffix((b) => I(b, inv) + 'n');
      return s;
    case 'loc':
      return s + D(s) + A(s, inv);
    case 'abl':
      return s + D(s) + A(s, inv) + 'n';
    case 'ins':
      return s + (endsVowel ? 'y' : '') + 'l' + A(s, inv);
  }
}

/** Глагол из инфинитива: gelmek → { stem: 'gel' }. Не глагол — null. */
export function verbOf(inf: string, extra: Omit<TrVerb, 'stem'> = {}): TrVerb | null {
  const m = inf.match(/^(.+)m[ea]k$/);
  return m ? { stem: m[1], ...extra } : null;
}

/** 13 односложных глаголов с широким временем на -Ir: gelir, alır, verir. Остальные односложные — на -Ar. */
const AORIST_I = new Set(['al', 'bil', 'bul', 'dur', 'gel', 'gör', 'kal', 'ol', 'öl', 'san', 'var', 'ver', 'vur']);

/** Основа глагола перед аффиксом на гласную: git → gid, et → ed. */
const verbBeforeVowel = (v: TrVerb) => (v.soft ? soften(v.stem) : v.stem);

/** Гласная широкого времени у основы на согласную. */
export function aoristVowel(v: TrVerb): 'I' | 'A' {
  if (v.aorist) return v.aorist;
  if (syllables(v.stem) > 1) return 'I';
  return AORIST_I.has(v.stem) ? 'I' : 'A';
}

export type TrTense = 'iyor' | 'di' | 'ecek' | 'ir' | 'mis';

/** Основа настоящего времени с -Iyor: geliyor, okuyor, başlıyor, bekliyor, diyor, gidiyor. */
function iyorBase(v: TrVerb): string {
  const s = v.stem;
  const last = s[s.length - 1];
  if (last === 'a' || last === 'e') {
    const rest = s.slice(0, -1);
    // de → diyor, ye → yiyor: в остатке гласной нет, гармония по выпавшей.
    return rest + (lastVowel(rest) ? I(rest) : I(last));
  }
  if (isVowel(last)) return s;
  const base = verbBeforeVowel(v);
  return base + I(s);
}

/** Окончания лица у -Iyor, -AcAk, -Ir, -mIş (первая группа) и у -DI (вторая). */
const PERSON_1 = (s: string) => [I(s) + 'm', 's' + I(s) + 'n', '', I(s) + 'z', 's' + I(s) + 'n' + I(s) + 'z', 'l' + A(s) + 'r'];
const PERSON_2 = (s: string) => ['m', 'n', '', 'k', 'n' + I(s) + 'z', 'l' + A(s) + 'r'];

/** Будущее: k перед гласной лица → ğ (geleceğim). */
function withPersons1(base: string): string[] {
  return PERSON_1(base).map((p) => (p && isVowel(p[0]) && base.endsWith('k') ? base.slice(0, -1) + 'ğ' + p : base + p));
}

/** Шесть форм времени, от «ben» до «onlar». Отрицание — с -mA-: gelmiyorum, gelmedim, gelmeyeceğim, gelmem. */
export function conjugate(v: TrVerb, tense: TrTense, negative = false): string[] {
  const s = v.stem;
  switch (tense) {
    case 'iyor': {
      const base = negative ? s + 'm' + I(s) + 'yor' : iyorBase(v) + 'yor';
      return ['um', 'sun', '', 'uz', 'sunuz', 'lar'].map((p) => base + p);
    }
    case 'di': {
      const base = negative ? s + 'm' + A(s) + 'd' + I(s + A(s)) : s + D(s) + I(s);
      return PERSON_2(base).map((p) => base + p);
    }
    case 'ecek': {
      let base: string;
      if (negative) base = s + 'm' + A(s) + 'y' + A(s) + 'c' + A(s) + 'k';
      else {
        const stem = s === 'de' ? 'diy' : s === 'ye' ? 'yiy' : isVowel(s[s.length - 1]) ? s + 'y' : verbBeforeVowel(v);
        base = stem + A(s) + 'c' + A(s) + 'k';
      }
      return withPersons1(base);
    }
    case 'ir': {
      if (negative) {
        const m = s + 'm' + A(s);
        return [m + 'm', m + 'zs' + I(m) + 'n', m + 'z', m + 'y' + I(m) + 'z', m + 'zs' + I(m) + 'n' + I(m) + 'z', m + 'zl' + A(m) + 'r'];
      }
      const base = isVowel(s[s.length - 1]) ? s + 'r' : verbBeforeVowel(v) + (aoristVowel(v) === 'I' ? I(s) : A(s)) + 'r';
      return withPersons1(base);
    }
    case 'mis': {
      const base = (negative ? s + 'm' + A(s) : s) + 'm' + I(negative ? s + A(s) : s) + 'ş';
      return withPersons1(base);
    }
  }
}

/** Инфинитив по основе: gel → gelmek, oku → okumak. */
export const infinitive = (stem: string) => stem + 'm' + A(stem) + 'k';

/** Все варианты аффикса по гармонии: «lAr» → lar, ler; «DIk» → dık, dik, duk, dük, tık, tik, tuk, tük. */
function variants(pattern: string): string[] {
  let out = [''];
  for (const ch of pattern) {
    const opts = ch === 'A' ? ['a', 'e'] : ch === 'I' ? ['ı', 'i', 'u', 'ü'] : ch === 'D' ? ['d', 't'] : ch === 'K' ? ['k', 'ğ'] : [ch];
    out = out.flatMap((o) => opts.map((x) => o + x));
  }
  return out;
}

/**
 * Позиции аффиксов в слове, от основы наружу. Разбор снимает аффиксы с конца и идёт только внутрь: после
 * падежа — принадлежность, множественное, время, но не второй падеж («burada» — bura-da, а не bur-a-da).
 * Связка идёт перед лицом: geliyor-du-m, evde-ydi-m. Глагольные позиции (1–2.5) — признак глагола.
 */
const SLOT = { abil: 1.2, neg: 1.5, tense: 2, vnoun: 2.5, deriv: 2.8, plural: 3, poss: 4, kase: 5, ki: 5.5, copula: 5.8, person: 6 } as const;
type Slot = (typeof SLOT)[keyof typeof SLOT];
const VERBAL_SLOTS = new Set<number>([SLOT.abil, SLOT.neg, SLOT.tense, SLOT.vnoun]);

const AFFIXES: [Slot, string[]][] = [
  [SLOT.person, ['sInIz', 'nIz', 'Iz', 'sIn', 'yIm', 'Im', 'yIz', 'lAr', 'm', 'n', 'k', 'z']],
  [SLOT.copula, ['DIr', 'yDI', 'DI', 'ymIş', 'mIş', 'ysA', 'sA', 'ken', 'yken']],
  [SLOT.ki, ['ki']],
  // Падежи и деепричастия (после деепричастия других аффиксов не бывает, как после падежа).
  [SLOT.kase, ['I', 'yI', 'nI', 'A', 'yA', 'nA', 'DA', 'nDA', 'DAn', 'nDAn', 'nIn', 'In', 'lA', 'ylA',
    'Ip', 'yIp', 'ArAk', 'yArAk', 'IncA', 'yIncA', 'mAdAn', 'DIkçA', 'DIğIndA']],
  [SLOT.poss, ['Im', 'm', 'In', 'n', 'I', 'sI', 'ImIz', 'mIz', 'InIz', 'nIz', 'lArI']],
  [SLOT.plural, ['lAr']],
  [SLOT.deriv, ['lI', 'sIz', 'lIk', 'cI', 'çI', 'cA', 'çA']],
  // Отглагольные имена и причастия: дальше идут как имя (множественное, принадлежность, падеж).
  [SLOT.vnoun, ['mAk', 'mA', 'Iş', 'yIş', 'An', 'yAn', 'DIK', 'yAcAK', 'AcAK', 'mAz']],
  // Времена, наклонения, повелительное и желательное.
  [SLOT.tense, ['AmAz', 'yAmAz', 'Iyor', 'yor', 'AcAK', 'yAcAK', 'mIş', 'DI', 'sA', 'mAlI', 'Ar', 'Ir', 'r', 'mAz', 'sIn', 'sInlAr',
    'AyIm', 'yAyIm', 'AlIm', 'yAlIm', 'In', 'yIn', 'InIz', 'yInIz']],
  [SLOT.neg, ['mA', 'mI', 'AmA', 'yAmA']],
  [SLOT.abil, ['Abil', 'yAbil']],
];
const SUFFIXES: [string, Slot][] = AFFIXES.flatMap(([slot, list]) => list.flatMap((p) => variants(p).map((v) => [v, slot] as [string, Slot])));
SUFFIXES.sort((a, b) => b[0].length - a[0].length);

/** Обратное озвончение: основа могла кончаться на p, ç, t, k (kitab → kitap, ağac → ağaç, ekmeğ → ekmek). */
function unsoften(s: string): string[] {
  const last = s[s.length - 1];
  const back: Record<string, string> = { b: 'p', c: 'ç', d: 't', ğ: 'k', g: 'k' };
  return back[last] ? [s, s.slice(0, -1) + back[last]] : [s];
}

/** Как получена основа: сама, с вернувшейся выпавшей гласной (ağz → ağız) или без удвоения (hakk → hak). */
export type TrRestore = 'plain' | 'drop' | 'double';

function restore(s: string): [string, TrRestore][] {
  const out: [string, TrRestore][] = [[s, 'plain']];
  const n = s.length;
  if (n >= 3 && !isVowel(s[n - 1]) && !isVowel(s[n - 2])) {
    out.push([s.slice(0, n - 1) + I(s.slice(0, n - 1)) + s[n - 1], 'drop']);
    if (s[n - 1] === s[n - 2]) out.push([s.slice(0, -1), 'double']);
  }
  return out;
}

/**
 * Возможные леммы словоформы и сколько аффиксов пришлось снять до каждой: сама форма (0), основы после снятия
 * аффиксов (с обратным озвончением, выпавшей гласной и удвоением) и инфинитивы этих основ. Перед -Iyor основа
 * могла кончаться на a/e (başlıyor → başla). После глагольного аффикса — только инфинитив. `known(лемма, глагол,
 * как получена)` отсеивает леммы, которых нет в словаре (глагол и имя раздельно: hamak — гамак, а не «ha» + -mak;
 * вернувшаяся гласная — только у слов с выпадением: ağzı — ağız, но yaptım — не yapıt).
 */
export function analyzeDepth(form: string, known?: (lemma: string, verb: boolean, how: TrRestore) => boolean, depth = 6): Map<string, number> {
  const out = new Map<string, number>();
  const seen = new Set<string>();
  const put = (lemma: string, d: number) => out.set(lemma, Math.min(out.get(lemma) ?? Infinity, d));
  const add = (stem: string, verbal: boolean, d: number) => {
    for (const a of unsoften(stem)) {
      for (const [b, how] of restore(a)) {
        if (b.length < 2) continue;
        if (!verbal && (!known || known(b, false, how))) put(b, d);
        // Голая основа глагола — повелительное, тоже форма: «der» скорее demek (de-r), чем dermek.
        const inf = infinitive(b);
        if (how === 'plain' && (!known || known(inf, true, how))) put(inf, d || 1);
      }
    }
  };
  const walk = (s: string, max: number, d: number, verbal: boolean) => {
    const key = `${s}|${max}|${verbal}|${d}`;
    if (seen.has(key)) return;
    seen.add(key);
    add(s, verbal, d);
    if (d >= depth) return;
    for (const [suf, slot] of SUFFIXES) {
      if (!s.endsWith(suf) || s.length - suf.length < 2) continue;
      // Внутрь — только к меньшей позиции; ki начинает новое имя (evde-ki-ler).
      if (!(slot < max || suf === 'ki')) continue;
      const rest = s.slice(0, -suf.length);
      const next = suf === 'ki' ? SLOT.ki : slot;
      const v = verbal || VERBAL_SLOTS.has(slot);
      walk(rest, next, d + 1, v);
      // başlıyor → başl + ıyor → başla; bekliyor → bekle; diyor → de. Достроенная гласная — лишний шаг:
      // biliyor — bil-iyor (bilmek), а не bile-iyor (bilemek «точить»).
      if (/^[ıiuü]yor$/.test(suf)) for (const vv of ['a', 'e']) walk(rest + vv, next, d + 2, true);
      // Буфер y: diyecek, yiyecek → de, ye.
      if (suf.startsWith('y') && /^(?:di|yi)$/.test(rest)) walk(rest[0] + 'e', next, d + 1, true);
    }
  };
  walk(form, 7, 0, false);
  return out;
}

/** Леммы словоформы: сначала разборы с меньшим числом аффиксов (karanlıkta — karanlık, а не kar-an-lık-ta). */
export function analyze(form: string, known?: (lemma: string, verb: boolean, how: TrRestore) => boolean): string[] {
  return [...analyzeDepth(form, known)].sort((a, b) => a[1] - b[1]).map(([l]) => l);
}
