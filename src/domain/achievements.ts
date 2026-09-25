export interface AchievementCtx {
  learnedWords: number;
  openBuildings: number;
  totalBuildings: number;
  maxBuildingLevel: number;
  streakBest: number;
  weekReviews: number;
  grammarDone: number;
  grammarA1Total: number;
  blitzBest: number;
  typedBest: number;
  freezesUsed: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  text: string;
  test(c: AchievementCtx): boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'word-1', emoji: '🌱', title: 'Первое слово', text: 'Выучить первое слово', test: (c) => c.learnedWords >= 1 },
  { id: 'word-50', emoji: '📗', title: 'Полсотни', text: 'Выучить 50 слов', test: (c) => c.learnedWords >= 50 },
  { id: 'word-200', emoji: '📚', title: 'Словарный запас', text: 'Выучить 200 слов', test: (c) => c.learnedWords >= 200 },
  { id: 'word-400', emoji: '🏛️', title: 'Библиотека', text: 'Выучить 400 слов', test: (c) => c.learnedWords >= 400 },
  { id: 'word-1000', emoji: '🌍', title: 'Полиглот', text: 'Выучить 1000 слов', test: (c) => c.learnedWords >= 1000 },
  { id: 'build-2', emoji: '🔑', title: 'Новосёл', text: 'Открыть второе здание', test: (c) => c.openBuildings >= 2 },
  { id: 'build-5', emoji: '🏘️', title: 'Квартал', text: 'Открыть 5 зданий', test: (c) => c.openBuildings >= 5 },
  { id: 'build-10', emoji: '🏙️', title: 'Район', text: 'Открыть 10 зданий', test: (c) => c.openBuildings >= 10 },
  { id: 'build-all', emoji: '🌆', title: 'Весь город', text: 'Открыть все здания', test: (c) => c.openBuildings >= c.totalBuildings },
  { id: 'level-3', emoji: '⭐', title: 'Три звезды', text: 'Улучшить здание до 3 уровня', test: (c) => c.maxBuildingLevel >= 3 },
  { id: 'level-5', emoji: '🏰', title: 'Небоскрёб', text: 'Улучшить здание до 5 уровня', test: (c) => c.maxBuildingLevel >= 5 },
  { id: 'streak-3', emoji: '🔥', title: 'Разогрев', text: 'Стрик 3 дня', test: (c) => c.streakBest >= 3 },
  { id: 'streak-7', emoji: '📅', title: 'Неделя', text: 'Стрик 7 дней', test: (c) => c.streakBest >= 7 },
  { id: 'streak-30', emoji: '🏆', title: 'Месяц', text: 'Стрик 30 дней', test: (c) => c.streakBest >= 30 },
  { id: 'reviews-100', emoji: '🔁', title: 'Повторение — мать учения', text: '100 повторений за неделю', test: (c) => c.weekReviews >= 100 },
  { id: 'grammar-1', emoji: '📘', title: 'Первое правило', text: 'Пройти урок грамматики', test: (c) => c.grammarDone >= 1 },
  { id: 'grammar-a1', emoji: '🎓', title: 'Район A1', text: 'Пройти всю грамматику A1', test: (c) => c.grammarA1Total > 0 && c.grammarDone >= c.grammarA1Total },
  { id: 'blitz-20', emoji: '⚡', title: 'Молния', text: '20 ответов в одном блице', test: (c) => c.blitzBest >= 20 },
  { id: 'typed-10', emoji: '⌨️', title: 'Без опечаток', text: '10 верных ответов вводом подряд', test: (c) => c.typedBest >= 10 },
  { id: 'freeze-1', emoji: '🧊', title: 'Спасённый стрик', text: 'Заморозка сохранила стрик', test: (c) => c.freezesUsed >= 1 },
];

export function newlyUnlocked(ctx: AchievementCtx, unlocked: Record<string, number>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.test(ctx));
}
