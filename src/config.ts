export type Variant = 'es-ES' | 'es-419';

// Переключатель варианта испанского. es-419 подставляет поле `latam` у слов
// и скрывает формы vosotros в грамматике.
export const VARIANT: Variant = 'es-ES';

export const VARIANTS: Record<Variant, { voices: string[]; vosotros: boolean; label: string }> = {
  'es-ES': { voices: ['es-ES'], vosotros: true, label: 'Испания' },
  'es-419': {
    voices: ['es-MX', 'es-US', 'es-419', 'es-AR', 'es-CO'],
    vosotros: false,
    label: 'Латинская Америка',
  },
};

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
/** Цвета плаща путника: зелёный — сразу, остальные за уровни. Картинки строит scripts/build-road-art.py. */
export type CloakId = 'moss' | 'crimson' | 'indigo' | 'night' | 'gold';

export type LevelReward = { hints?: number; blitz?: BlitzMode; cloak?: CloakId };

/**
 * Награды за уровни героя (задача 9.2). Жетон подсказки открывает первую букву ответа при вводе, такой ответ
 * засчитывается не выше «почти» (оценка Hard). Выше таблицы — по 5 жетонов на каждом чётном уровне.
 * Выдаются и задним числом: за уровень, набранный до появления наград.
 */
export const LEVEL_REWARDS: Record<number, LevelReward> = {
  2: { hints: 3 },
  3: { blitz: 'listen' },
  4: { cloak: 'crimson', hints: 3 },
  5: { hints: 5 },
  6: { blitz: 'survival' },
  7: { cloak: 'indigo' },
  8: { hints: 5 },
  10: { cloak: 'night', hints: 5 },
  12: { hints: 5 },
  14: { cloak: 'gold' },
};
export const LEVEL_REWARDS_UPTO = 14;
export const LATE_LEVEL_HINTS = 5;
