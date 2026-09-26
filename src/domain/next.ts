import type { LocationId, LocationMeta, Word } from '../content/schema';
import { upgradeCost } from './economy';
import { isScrollId, isWordId } from './itemId';
import { isLearned, lessonParts, levelWords, maxContentLevel } from './levels';

export type NextStep =
  | { kind: 'learn'; loc: LocationId; level: number; part: number; newWords: number }
  | { kind: 'upgrade'; loc: LocationId; toLevel: number; cost: number; missing: number }
  | { kind: 'unlock'; loc: LocationId; cost: number; missing: number }
  /** Всё открытое пройдено, дальше нужна следующая глава: сначала собрать карту текущей. */
  | { kind: 'chapter'; next: number }
  /**
   * Сначала поручения: новых слов на сегодня уже достаточно (`limit`) или к повтору накопилось слишком много
   * (`backlog`). Урок, который был бы следующим, лежит в `then`: учить дальше можно.
   */
  | { kind: 'errands'; reason: 'limit' | 'backlog'; due: number; then: NextStep }
  | { kind: 'done' };

export interface NextInput {
  /** Локации в порядке города. */
  locations: LocationMeta[];
  /** Уровень зданий, 0 или нет записи — закрыто. */
  levels: Partial<Record<LocationId, number>>;
  /** Слова открытых локаций. Если локации здесь нет, её пропускаем. */
  words: Partial<Record<LocationId, Word[]>>;
  cards: Record<string, unknown>;
  coins: number;
  /** Где учились в последний раз: её проверяем первой. */
  recent?: LocationId;
  /** Открыт ли уровень слов по главе. По умолчанию открыты все. */
  isLevelOpen?: (level: number) => boolean;
  /** Глава уровня: чтобы сказать, какая глава нужна дальше. */
  chapterOf?: (level: number) => number;
  /** Цена улучшения с учётом скидки жителя места. По умолчанию без скидки. */
  discount?: (loc: LocationId, cost: number) => number;
  /** Дневной лимит новых слов: выучено сегодня, лимит и сколько карточек ждут повтора. Без него лимита нет. */
  limit?: { newToday: number; perDay: number; due: number };
}

/**
 * Ближайший шаг с дневным лимитом новых слов (задача 3.7): если следующий шаг — урок с новыми словами,
 * а новых сегодня уже `perDay` (и есть что повторить) или к повтору больше `perDay × 5` карточек, первыми
 * предлагаются поручения.
 */
export function nextStepWithLimit(input: NextInput): NextStep {
  const step = nextStep(input);
  const l = input.limit;
  if (!l || step.kind !== 'learn' || step.newWords === 0) return step;
  if (l.due > l.perDay * 5) return { kind: 'errands', reason: 'backlog', due: l.due, then: step };
  // Лимит зовёт на поручения, только если есть что повторить: иначе он просто не мешает учить.
  if (l.newToday >= l.perDay && l.due > 0) return { kind: 'errands', reason: 'limit', due: l.due, then: step };
  return step;
}

/**
 * Ближайший шаг обучения: непройденный урок в открытых зданиях,
 * затем улучшение здания с выученным уровнем, затем открытие нового здания.
 */
export function nextStep({
  locations, levels, words, cards, coins, recent, isLevelOpen = () => true, chapterOf = () => 1, discount = (_, c) => c,
}: NextInput): NextStep {
  const order = recent ? [recent, ...locations.map((l) => l.id).filter((id) => id !== recent)] : locations.map((l) => l.id);
  const meta = Object.fromEntries(locations.map((l) => [l.id, l])) as Record<LocationId, LocationMeta>;

  // Ближайшая закрытая глава, в которую упёрлись: её покажем, если делать больше нечего.
  let blocked: number | null = null;
  for (const id of order) {
    const lvl = levels[id] ?? 0;
    const ws = words[id];
    if (!lvl || !ws) continue;
    for (let level = 1; level <= lvl; level++) {
      if (!isLevelOpen(level)) {
        if (!isLearned(levelWords(ws, level), cards)) blocked = Math.min(blocked ?? Infinity, chapterOf(level));
        break;
      }
      const parts = lessonParts(levelWords(ws, level));
      const part = parts.findIndex((p) => !isLearned(p, cards));
      if (part >= 0) {
        const newWords = parts[part].filter((w) => !(w.id in cards)).length;
        return { kind: 'learn', loc: id, level, part, newWords };
      }
    }
  }

  for (const id of order) {
    const lvl = levels[id] ?? 0;
    const ws = words[id];
    if (!lvl || !ws || lvl >= 5 || lvl >= maxContentLevel(ws)) continue;
    if (!isLearned(levelWords(ws, lvl), cards)) continue;
    // Следующий уровень в закрытой главе: здание подождёт.
    if (!isLevelOpen(lvl + 1)) {
      blocked = Math.min(blocked ?? Infinity, chapterOf(lvl + 1));
      continue;
    }
    const cost = discount(id, upgradeCost(meta[id], lvl + 1));
    return { kind: 'upgrade', loc: id, toLevel: lvl + 1, cost, missing: Math.max(0, cost - coins) };
  }

  const locked = locations.find((l) => !(levels[l.id] ?? 0));
  if (locked) return { kind: 'unlock', loc: locked.id, cost: locked.unlockCost, missing: Math.max(0, locked.unlockCost - coins) };
  if (blocked !== null) return { kind: 'chapter', next: blocked };
  return { kind: 'done' };
}

/** Локация, где последним выучено слово. */
export function recentLocation(cards: Record<string, { learnedAt: number }>): LocationId | undefined {
  let best: { id: string; t: number } | null = null;
  for (const [id, c] of Object.entries(cards)) {
    // Правила, фразы и слова свитков не относятся к урокам слов места.
    if (!isWordId(id) || isScrollId(id)) continue;
    if (!best || c.learnedAt > best.t) best = { id, t: c.learnedAt };
  }
  return best ? (best.id.split('.')[0] as LocationId) : undefined;
}
