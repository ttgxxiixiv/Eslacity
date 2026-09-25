import type { LocationId, LocationMeta, Word } from '../content/schema';
import { upgradeCost } from './economy';
import { isLearned, lessonParts, levelWords, maxContentLevel } from './levels';

export type NextStep =
  | { kind: 'learn'; loc: LocationId; level: number; part: number; newWords: number }
  | { kind: 'upgrade'; loc: LocationId; toLevel: number; cost: number; missing: number }
  | { kind: 'unlock'; loc: LocationId; cost: number; missing: number }
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
}

/**
 * Ближайший шаг обучения: непройденный урок в открытых зданиях,
 * затем улучшение здания с выученным уровнем, затем открытие нового здания.
 */
export function nextStep({ locations, levels, words, cards, coins, recent }: NextInput): NextStep {
  const order = recent ? [recent, ...locations.map((l) => l.id).filter((id) => id !== recent)] : locations.map((l) => l.id);
  const meta = Object.fromEntries(locations.map((l) => [l.id, l])) as Record<LocationId, LocationMeta>;

  for (const id of order) {
    const lvl = levels[id] ?? 0;
    const ws = words[id];
    if (!lvl || !ws) continue;
    for (let level = 1; level <= lvl; level++) {
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
    const cost = upgradeCost(meta[id], lvl + 1);
    return { kind: 'upgrade', loc: id, toLevel: lvl + 1, cost, missing: Math.max(0, cost - coins) };
  }

  const locked = locations.find((l) => !(levels[l.id] ?? 0));
  if (locked) return { kind: 'unlock', loc: locked.id, cost: locked.unlockCost, missing: Math.max(0, locked.unlockCost - coins) };
  return { kind: 'done' };
}

/** Локация, где последним выучено слово. */
export function recentLocation(cards: Record<string, { learnedAt: number }>): LocationId | undefined {
  let best: { id: string; t: number } | null = null;
  for (const [id, c] of Object.entries(cards)) if (!best || c.learnedAt > best.t) best = { id, t: c.learnedAt };
  return best ? (best.id.split('.')[0] as LocationId) : undefined;
}
