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
