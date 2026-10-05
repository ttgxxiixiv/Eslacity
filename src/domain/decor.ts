import { currentTier, TIERS, type LineId, type MedalsState, type Tier } from './medals';
import { H_ROADS, V_ROADS, type Point } from './townMap';

/**
 * Облик героя и украшения города (задача 9.3). Золотая медаль линии ставит на перекрёсток карты города её
 * украшение: у каждой из двенадцати линий свой перекрёсток (их тоже двенадцать) и своё украшение. Фонарь путника
 * светит цветом лучшей медали. Всё выводится из медалей, полученное не отнимается; в записи наград хранятся
 * только выбор фонаря и выключенные украшения.
 */

export type DecorKind = 'flag' | 'lamp' | 'flowers' | 'well';

export interface Decor {
  line: LineId;
  kind: DecorKind;
  /** Название в профиле. */
  title: string;
  /** Цвет полотнища флага, огня фонаря или цветов клумбы. */
  color: string;
  /** Перекрёсток: номер вертикальной и горизонтальной дороги. */
  at: [number, number];
}

/** С какой медали линии ставится украшение. */
export const DECOR_TIER: Tier = 'gold';

/** Украшения линий по перекрёсткам: сверху вниз, слева направо. */
export const DECOR: Decor[] = [
  { line: 'words', kind: 'flag', title: 'Знамя Словесника', color: '#2f5fa8', at: [0, 0] },
  { line: 'grammar', kind: 'flowers', title: 'Клумба Знатока правил', color: '#8a4fc4', at: [1, 0] },
  { line: 'streak', kind: 'lamp', title: 'Фонарь Упорства', color: '#ff9a2e', at: [2, 0] },
  { line: 'cartographer', kind: 'flag', title: 'Знамя Картографа', color: '#3c8a3c', at: [0, 1] },
  { line: 'builder', kind: 'well', title: 'Колодец Строителя', color: '#5a8fc4', at: [1, 1] },
  { line: 'friend', kind: 'flowers', title: 'Клумба Друга города', color: '#d8435a', at: [2, 1] },
  { line: 'courier', kind: 'lamp', title: 'Фонарь Посыльного', color: '#ffd24a', at: [0, 2] },
  { line: 'trials', kind: 'flag', title: 'Знамя Испытателя', color: '#b3261e', at: [1, 2] },
  { line: 'listener', kind: 'flowers', title: 'Клумба Слушателя', color: '#4fa8c4', at: [2, 2] },
  { line: 'blitz', kind: 'flag', title: 'Знамя Молнии', color: '#e0b43c', at: [0, 3] },
  { line: 'typed', kind: 'well', title: 'Колодец Твёрдой руки', color: '#7a9a6a', at: [1, 3] },
  { line: 'echo', kind: 'lamp', title: 'Фонарь Эха', color: '#b48cff', at: [2, 3] },
];

/** Точка перекрёстка украшения на карте, в пикселях картинки города. */
export const decorSpot = (d: Decor): Point => ({ x: V_ROADS[d.at[0]], y: H_ROADS[d.at[1]] });

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
