import { currentTier, TIERS, type LineId, type MedalsState, type Tier } from './medals';
import type { LocationId } from '../content/schema';

/**
 * Облик героя и украшения города (задача 9.3). Золотая медаль линии украшает здание города: у каждой из двенадцати
 * линий своё здание и своё украшение. На карте участок здания берётся из картинки с украшениями
 * (`src/assets/city-decor.webp`, та же сетка, что у основной карты), значок в профиле — `src/assets/decor/<линия>.webp`
 * (режет `scripts/build-decor-art.py`). Фонарь путника светит цветом лучшей медали. Всё выводится из медалей,
 * полученное не отнимается; в записи наград хранятся только выбор фонаря и выключенные украшения.
 */

export interface Decor {
  line: LineId;
  /** Название в профиле. */
  title: string;
  /** Здание, у которого стоит украшение. */
  place: LocationId;
  /** Цвет свечения значка у фонарей и гирлянды. */
  glow?: string;
}

/** С какой медали линии ставится украшение. */
export const DECOR_TIER: Tier = 'gold';

/** Украшения линий в порядке листа `docs/design/decor.png`. */
export const DECOR: Decor[] = [
  { line: 'words', title: 'Знамя Словесника', place: 'school' },
  { line: 'grammar', title: 'Клумба Знатока правил', place: 'pharmacy' },
  { line: 'streak', title: 'Гирлянда Упорства', place: 'cafe', glow: '#ff9a2e' },
  { line: 'cartographer', title: 'Знамя Картографа', place: 'station' },
  { line: 'builder', title: 'Колодец Строителя', place: 'home' },
  { line: 'friend', title: 'Флажки Друга города', place: 'market' },
  { line: 'courier', title: 'Фонари Посыльного', place: 'post', glow: '#ffd24a' },
  { line: 'trials', title: 'Знамёна Испытателя', place: 'gym' },
  { line: 'listener', title: 'Колокольчики Слушателя', place: 'park' },
  { line: 'blitz', title: 'Флюгер Молнии', place: 'airport' },
  { line: 'typed', title: 'Фонтан Твёрдой руки', place: 'bank' },
  { line: 'echo', title: 'Фонари Эха', place: 'hotel', glow: '#b48cff' },
];

const reached = (tier: Tier | null, need: Tier) => tier !== null && TIERS.indexOf(tier) >= TIERS.indexOf(need);

/** Украшения, которые открыла медаль. */
export function unlockedDecor(medals: MedalsState): Decor[] {
  return DECOR.filter((d) => reached(currentTier(medals.lines[d.line]), DECOR_TIER));
}

/** Украшения на карте: открытые и не выключенные игроком. */
export function shownDecor(medals: MedalsState, hidden: string[] = []): Decor[] {
  return unlockedDecor(medals).filter((d) => !hidden.includes(d.line));
}

export type LanternId = 'amber' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface Lantern {
  id: LanternId;
  title: string;
  /** Цвет огня и мягкого свечения вокруг. */
  flame: string;
  glow: string;
  /** Нужна медаль этого достоинства в любой линии; у обычного фонаря условия нет. */
  tier: Tier | null;
}

export const LANTERNS: Lantern[] = [
  { id: 'amber', title: 'Масляный', flame: '#ffcc4a', glow: 'rgba(255,190,70,0.45)', tier: null },
  { id: 'bronze', title: 'Медный', flame: '#ff9a3c', glow: 'rgba(255,140,50,0.5)', tier: 'bronze' },
  { id: 'silver', title: 'Лунный', flame: '#e6f0ff', glow: 'rgba(200,220,255,0.55)', tier: 'silver' },
  { id: 'gold', title: 'Солнечный', flame: '#ffe680', glow: 'rgba(255,215,90,0.65)', tier: 'gold' },
  { id: 'diamond', title: 'Звёздный', flame: '#9ff0ff', glow: 'rgba(120,230,255,0.65)', tier: 'diamond' },
];

/** Лучшая медаль во всех линиях. */
export function bestTier(medals: MedalsState): Tier | null {
  let best: Tier | null = null;
  for (const rec of Object.values(medals.lines)) {
    const t = currentTier(rec);
    if (t && (best === null || TIERS.indexOf(t) > TIERS.indexOf(best))) best = t;
  }
  return best;
}

/** Фонари, которые путник уже может взять. */
export function unlockedLanterns(medals: MedalsState): Lantern[] {
  const best = bestTier(medals);
  return LANTERNS.filter((l) => l.tier === null || reached(best, l.tier));
}

/** Фонарь в руке: выбранный, если он открыт, иначе обычный. */
export function lanternOf(medals: MedalsState, picked: LanternId | undefined): Lantern {
  const open = unlockedLanterns(medals);
  return open.find((l) => l.id === picked) ?? LANTERNS[0];
}
