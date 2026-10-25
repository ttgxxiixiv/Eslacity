import type { Scene, SceneLine } from '../content/schema';
import { LANG, type Lang } from '../lang';
import { canon, checkPhrase, stripAccents, type CheckResult } from './answer';
import { sceneWords } from './sceneText';

/**
 * Диктант (задача 21.5): житель места говорит реплику из разговора, который герой уже дослушал, герой записывает
 * её целиком. Проверка — как у фразы (`checkPhrase`: ударения и редкие опечатки — «почти»), пропущенные и
 * неверные слова подсвечиваются. Диктант стоит в начале обычного поручения жителя с главы II.
 */

/** С этой главы в поручениях бывает диктант. */
export const DICTATION_CHAPTER = 2;
/** Реплика для диктанта: не короче и не длиннее стольких слов. */
export const DICTATION_MIN_WORDS = 3;
export const DICTATION_MAX_WORDS = 14;
/** Темп кнопки «Медленнее» в разговоре и диктанте. */
export const SLOW_RATE = 0.7;

export interface DictationLine {
  sceneId: string;
  /** Номер реплики в сцене, как в отчётах об ошибках. */
  index: number;
  line: SceneLine;
}

/** id ответа в журнале: `sc:cafe.2#4`. */
export const dictationId = (d: Pick<DictationLine, 'sceneId' | 'index'>) => `${d.sceneId}#${d.index}`;

const wordCount = (text: string, lang: Lang) => sceneWords(text, lang).filter((p) => 'word' in p).length;

/**
 * Реплики для диктанта из дослушанных разговоров места: говорит сам житель (`npc` или его id, его голосом и прозвучит), без условия
 * истории (у другого героя её не было), от `DICTATION_MIN_WORDS` до `DICTATION_MAX_WORDS` слов.
 */
export function dictationLines(scenes: Scene[], heard: ReadonlySet<string>, lang: Lang = LANG): DictationLine[] {
  return scenes
    .filter((s) => heard.has(s.id) && !s.mode)
    .flatMap((s) =>
      s.lines.flatMap((line, index) => {
        if ((line.who !== 'npc' && line.who !== s.npc) || line.if) return [];
        const n = wordCount(line.es, lang);
        return n >= DICTATION_MIN_WORDS && n <= DICTATION_MAX_WORDS ? [{ sceneId: s.id, index, line }] : [];
      }),
    );
}

/** Реплика по зерну (`0 ≤ seed < 1`): одна и та же для поручения весь день. */
export function pickDictation(lines: DictationLine[], seed: number): DictationLine | undefined {
  return lines.length ? lines[Math.floor(seed * lines.length) % lines.length] : undefined;
}

export interface DictationWord {
  /** Слово как в реплике, со знаками вокруг. */
  text: string;
  /** Слово есть в ответе на своём месте (ударение не в счёт: его оценивает вердикт). */
  ok: boolean;
}

export interface DictationResult extends CheckResult {
  words: DictationWord[];
}

/** Слово для сравнения: форма ответа (`canon`: регистр, сокращения, написание) без ударений, по частям. */
const parts = (s: string, lang: Lang) => stripAccents(canon(s, lang)).split(' ').filter(Boolean);

/**
 * Проверка диктанта: вердикт фразы и слова реплики с отметкой, есть ли они в ответе. Слово найдено, если все его
 * части стоят в ответе в том же порядке (наибольшая общая подпоследовательность).
 */
export function checkDictation(input: string, text: string, lang: Lang = LANG): DictationResult {
  const result = checkPhrase(input, { es: text });
  // Слова — по пробелам, со знаками: «don't» целиком (его форма — «do not»), «¿Quieres» вместе со знаком.
  const pieces = text.split(/\s+/).filter((p) => parts(p, lang).length);
  const want = pieces.flatMap((p, w) => parts(p, lang).map((t) => ({ t, w })));
  const got = parts(input, lang);
  // Таблица НОП: lcs[i][j] — длина для want[i..] и got[j..].
  const lcs = Array.from({ length: want.length + 1 }, () => Array.from({ length: got.length + 1 }, () => 0));
  for (let i = want.length - 1; i >= 0; i--) {
    for (let j = got.length - 1; j >= 0; j--) {
      lcs[i][j] = want[i].t === got[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const hit = new Set<number>();
  for (let i = 0, j = 0; i < want.length && j < got.length; ) {
    if (want[i].t === got[j]) {
      hit.add(i);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  const words = pieces.map((p, w) => ({
    text: p,
    ok: want.every((x, i) => x.w !== w || hit.has(i)),
  }));
  return { ...result, words };
}
