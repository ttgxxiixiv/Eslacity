export const ECONOMY = {
  coinPerCorrect: 1,
  lessonBonus: 15,
  grammarBonus: 10,
  incomePerLevelPerHour: 2,
  incomeCapHours: 8,
  upgradeFactor: 0.8,
  minUpgradeCost: 40,
  freezeCost: 150,
  maxFreezes: 2,
};

export const XP = {
  correct: 5,
  almost: 3,
  blitzCorrect: 2,
};

export const LESSON = {
  maxWordsPerLesson: 6,
  reviewBatch: 20,
  blitzSeconds: 60,
  blitzMinWords: 8,
  // Опечатка (Левенштейн 1) прощается только если в слове хотя бы столько букв:
  // иначе yo/ya, no/ni превращались бы в «почти».
  typoMinLength: 4,
};

/** Режимы блица: обычный открыт сразу, остальные — наградой за уровень героя (задача 9.2). */
export type BlitzMode = 'classic' | 'listen' | 'survival';
/**
 * Накидки путника — по материалу, от самой простой к самой благородной (задача 9.2). Мешковина — сразу.
 * Картинки строит scripts/build-road-art.py.
 */
export type CloakId = 'sackcloth' | 'homespun' | 'linen' | 'broadcloth' | 'leather' | 'velvet' | 'silk' | 'brocade';

export type LevelReward = { hints?: number; blitz?: BlitzMode; cloak?: CloakId };

/**
 * Награды за уровни героя (задача 9.2). Весь путь до Сфинкса — примерно 135–215 тысяч опыта, это 26–31-й уровень
 * (расчёт в docs/GAME.md, «Награды уровней героя»). Накидки идут по нарастающей: чем благороднее материал, тем
 * дальше до него по опыту, последняя — парча на 26-м уровне, к концу главы IV. Остальные уровни дают жетоны
 * подсказки (`hintsFor`): жетон открывает первую букву ответа при вводе, такой ответ засчитывается не выше
 * «почти» (оценка Hard). Награды выдаются и задним числом.
 */
export const LEVEL_REWARDS: Record<number, LevelReward> = {
  3: { blitz: 'listen' },
  4: { cloak: 'homespun' },
  6: { blitz: 'survival' },
  9: { cloak: 'linen' },
  13: { cloak: 'broadcloth' },
  17: { cloak: 'leather' },
  20: { cloak: 'velvet' },
  23: { cloak: 'silk' },
  26: { cloak: 'brocade' },
};
/** Жетоны подсказки за уровень без другой награды: по 3 до 9-го, дальше по 5. */
export const hintsFor = (level: number) => (level < 2 ? 0 : level < 10 ? 3 : 5);
