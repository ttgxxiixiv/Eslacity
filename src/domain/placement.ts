import { PROLOGUE_WORDS } from './prologue';
import type { GrammarExercise, Word } from '../content/schema';
import { CHAPTERS } from './chapters';
import { shuffle, type Rng } from './generators';
import { toItem } from './grammar';
import { makeStep } from './lessonQueue';
import type { TrialItem } from './trial';

/**
 * Входной тест (задача 9.1), в игре — расспросы Летописца: где путник уже побывал. Идёт по главам от I к V,
 * в каждой — блок из 10 заданий: 6 слов уровней главы и 4 правила её района. Блок засчитан при 80% верных
 * («почти» — тоже верно), тогда следующий блок — глава сложнее; незасчитанный блок заканчивает тест, и путник
 * начинает с этой главы. Засчитанные главы дают обрывки и печати, верно названные слова — карточки
 * с увеличенной стабильностью. Печать главы V тест не даёт: к Сфинксу ведёт только победа над Хозяином Эха.
 */

export const PLACEMENT_WORDS = 6;
export const PLACEMENT_RULES = 4;
export const PLACEMENT_PASS = 0.8;
/** Печати до этой главы включительно; обрывки — до последней засчитанной. */
export const PLACEMENT_SEAL_MAX = 4;
/** Задания слов в блоке: выбор в обе стороны и одно с вводом. */
const WORD_KINDS = ['choice-ru-es', 'choice-es-ru', 'choice-ru-es', 'choice-es-ru', 'choice-ru-es', 'type'] as const;
/** Правила — только быстрые задания с выбором. */
const RULE_KINDS = new Set<GrammarExercise['kind']>(['choose', 'gap', 'truefalse']);

export interface PlacementRecord {
  /** Когда тест пройден (последний раз). */
  done?: number;
  /** Путник отказался от теста при первом запуске. */
  skipped?: number;
  /** Лучший результат: засчитано глав подряд с первой. */
  passed?: number;
}

export const EMPTY_PLACEMENT: PlacementRecord = {};

/**
 * Предложить тест на главной: курс только начат и путник ещё не решил. Три слова пролога (задача 13.2) не в счёт:
 * тест предлагается после него.
 */
export const placementOffered = (r: PlacementRecord, learnedWords: number) =>
  r.done === undefined && r.skipped === undefined && learnedWords <= PROLOGUE_WORDS;

/**
 * Блок главы: 6 слов (без выражений) и 4 правила из разных уроков, вперемешку. `lessons` — упражнения по урокам
 * района главы.
 */
export function placementBlock(words: Word[], lessons: GrammarExercise[][], rng: Rng): TrialItem[] {
  const pool = words.filter((w) => !w.kind);
  const picked = shuffle(pool, rng).slice(0, PLACEMENT_WORDS);
  const wordItems: TrialItem[] = picked.map((w, i) => ({ kind: 'word', step: makeStep(WORD_KINDS[i % WORD_KINDS.length], w, pool, rng) }));
  const rules = shuffle(lessons.filter((l) => l.some((e) => RULE_KINDS.has(e.kind))), rng)
    .slice(0, PLACEMENT_RULES)
    .map((l) => shuffle(l.filter((e) => RULE_KINDS.has(e.kind)), rng)[0]);
  const ruleItems: TrialItem[] = rules.map((ex) => ({ kind: 'grammar', item: toItem(ex, rng) }));
  return shuffle([...wordItems, ...ruleItems], rng);
}

export const blockPassed = (good: number, total: number) => total > 0 && good / total >= PLACEMENT_PASS - 1e-9;

/** Что дают засчитанные главы: обрывки всех мест, печати до IV, уровень зданий по словам этих глав. */
export function placementGrant(passed: number): { fragmentChapters: number[]; sealChapters: number[]; buildingLevel: number } {
  const chapters = CHAPTERS.filter((c) => c.id <= passed);
  return {
    fragmentChapters: chapters.map((c) => c.id),
    sealChapters: chapters.filter((c) => c.id <= PLACEMENT_SEAL_MAX).map((c) => c.id),
    // Здание растёт до 5-го уровня; следующий уровень слов путник открывает сам.
    buildingLevel: Math.min(5, Math.max(0, ...chapters.flatMap((c) => c.levels))),
  };
}

/** Стабильность карточки слова, названного в тесте: 10–20 дней, чтобы повторения не пришли в один день. */
export const knownDays = (i: number) => 10 + (i % 11);
