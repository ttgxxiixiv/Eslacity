/**
 * Медали (docs/GAME.md, раздел «Медали»). Линия медалей — один счётчик и шесть порогов, ступени
 * от дерева до бриллианта. Кроме линий есть тайные одиночные медали, которые не видны до получения.
 */

export type Tier = 'wood' | 'stone' | 'bronze' | 'silver' | 'gold' | 'diamond';

export const TIERS: Tier[] = ['wood', 'stone', 'bronze', 'silver', 'gold', 'diamond'];

/** gen — «до серебра». color — цвет рамки плашки вручения. */
export const TIER_INFO: Record<Tier, { ru: string; adj: string; gen: string; reward: number; color: string }> = {
  wood: { ru: 'Дерево', adj: 'Деревянная', gen: 'дерева', reward: 10, color: '#8a5a2b' },
  stone: { ru: 'Камень', adj: 'Каменная', gen: 'камня', reward: 25, color: '#8f8b84' },
  bronze: { ru: 'Бронза', adj: 'Бронзовая', gen: 'бронзы', reward: 50, color: '#b8733a' },
  silver: { ru: 'Серебро', adj: 'Серебряная', gen: 'серебра', reward: 100, color: '#c3c9d1' },
  gold: { ru: 'Золото', adj: 'Золотая', gen: 'золота', reward: 200, color: '#e0b43c' },
  diamond: { ru: 'Бриллиант', adj: 'Бриллиантовая', gen: 'бриллианта', reward: 500, color: '#7fd8f0' },
};

/** Русское множественное число: plural(5, ['слово', 'слова', 'слов']). */
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

/** Счётчики, по которым считаются линии. Будущие системы добавят свои поля. */
export interface MedalCounters {
  /** Закреплённые слова: пока интервал SM-2 не меньше 21 дня, после задачи 3.2 — стабильность FSRS. */
  wordsSolid: number;
  streakBest: number;
  grammarDone: number;
  blitzBest: number;
  typedBest: number;
  /** Сумма уровней всех зданий. */
  buildingLevels: number;
  /** Верные ответы в заданиях на слух за всё время. */
  listenCorrect: number;
  freezesUsed: number;
  /** Полученные обрывки карты во всех главах. */
  fragments: number;
}

export type LineId =
  | 'words' | 'streak' | 'grammar' | 'cartographer' | 'friend' | 'courier'
  | 'blitz' | 'typed' | 'builder' | 'trials' | 'listener' | 'echo';

export interface MedalLine {
  id: LineId;
  title: string;
  /** Что считается, для подписи: «закреплённые слова». */
  counts: string;
  /** Пороги ступеней от дерева до бриллианта. */
  thresholds: [number, number, number, number, number, number];
  /** Единица счётчика для строки прогресса: «312 / 500 слов до бронзы». */
  unit: [string, string, string];
  /** Счётчик линии. null — система ещё не сделана, линия выключена. */
  value: ((c: MedalCounters) => number) | null;
}

export const LINES: MedalLine[] = [
  { id: 'words', title: 'Словесник', counts: 'закреплённые слова', thresholds: [10, 100, 500, 1200, 2200, 3000], unit: ['слово', 'слова', 'слов'], value: (c) => c.wordsSolid },
  { id: 'streak', title: 'Упорство', counts: 'лучший стрик, дней', thresholds: [3, 7, 14, 30, 100, 365], unit: ['день', 'дня', 'дней'], value: (c) => c.streakBest },
  { id: 'grammar', title: 'Знаток правил', counts: 'пройденные уроки грамматики', thresholds: [1, 10, 31, 62, 100, 132], unit: ['урок', 'урока', 'уроков'], value: (c) => c.grammarDone },
  { id: 'cartographer', title: 'Картограф', counts: 'собранные обрывки карты', thresholds: [1, 5, 25, 50, 75, 100], unit: ['обрывок', 'обрывка', 'обрывков'], value: (c) => c.fragments },
  // Включится с репутацией жителей (этап 4).
  { id: 'friend', title: 'Друг города', counts: 'жители с отношением «Друг» и выше', thresholds: [1, 3, 7, 12, 17, 20], unit: ['житель', 'жителя', 'жителей'], value: null },
  // Включится с поручениями (этап 4).
  { id: 'courier', title: 'Посыльный', counts: 'выполненные поручения', thresholds: [1, 10, 50, 150, 400, 1000], unit: ['поручение', 'поручения', 'поручений'], value: null },
  { id: 'blitz', title: 'Молния', counts: 'лучший результат блица', thresholds: [10, 20, 30, 40, 50, 60], unit: ['ответ', 'ответа', 'ответов'], value: (c) => c.blitzBest },
  { id: 'typed', title: 'Твёрдая рука', counts: 'верных вводов подряд', thresholds: [5, 10, 20, 35, 50, 100], unit: ['ввод', 'ввода', 'вводов'], value: (c) => c.typedBest },
  { id: 'builder', title: 'Строитель', counts: 'сумма уровней зданий', thresholds: [2, 10, 25, 50, 75, 100], unit: ['уровень', 'уровня', 'уровней'], value: (c) => c.buildingLevels },
  // Включится с испытаниями мест и стражей (этап 5).
  { id: 'trials', title: 'Испытатель', counts: 'пройденные испытания мест и стражей', thresholds: [1, 5, 25, 50, 80, 105], unit: ['испытание', 'испытания', 'испытаний'], value: null },
  { id: 'listener', title: 'Слушатель', counts: 'верные задания на слух', thresholds: [10, 50, 200, 500, 1000, 2500], unit: ['ответ', 'ответа', 'ответов'], value: (c) => c.listenCorrect },
  // Включится с Лабиринтом Эха (глава V).
  { id: 'echo', title: 'Эхо', counts: 'выражения, сказанные в другом регистре', thresholds: [1, 10, 30, 80, 150, 300], unit: ['выражение', 'выражения', 'выражений'], value: null },
];

export const ACTIVE_LINES = LINES.filter((l) => l.value);

/** Высшая ступень, которой достигает значение, или null. */
export function tierFor(line: MedalLine, value: number): Tier | null {
  let got: Tier | null = null;
  line.thresholds.forEach((t, i) => {
    if (value >= t) got = TIERS[i];
  });
  return got;
}

/** Порог следующей ступени или null, если бриллиант уже получен. */
export function nextThreshold(line: MedalLine, value: number): { tier: Tier; at: number } | null {
  const i = line.thresholds.findIndex((t) => value < t);
  return i < 0 ? null : { tier: TIERS[i], at: line.thresholds[i] };
}

/** Полученные ступени линии и время получения каждой. */
export type LineRecord = Partial<Record<Tier, number>>;

export function currentTier(rec: LineRecord | undefined): Tier | null {
  if (!rec) return null;
  for (let i = TIERS.length - 1; i >= 0; i--) if (rec[TIERS[i]] !== undefined) return TIERS[i];
  return null;
}

/** События, после которых проверяются тайные медали. */
export interface MedalEvent {
  /** Урок закончен без единой ошибки и без «почти». */
  perfectLesson?: boolean;
  /** Время окончания урока (для «Полночного путника»). */
  lessonAt?: number;
}

export interface SecretMedal {
  id: string;
  title: string;
  text: string;
  test: ((c: MedalCounters, e: MedalEvent) => boolean) | null;
}

/** Награда за тайную медаль. */
export const SECRET_REWARD = 50;

/** Итог урока слов или повторения для тайных медалей. */
export function lessonEvent(s: { correct: number; almost: number; wrong: number }, now = Date.now()): MedalEvent {
  return { perfectLesson: s.correct > 0 && s.almost === 0 && s.wrong === 0, lessonAt: now };
}

/** Урок с полуночи до четырёх утра по времени устройства. */
export function isMidnight(ts: number): boolean {
  return new Date(ts).getHours() < 4;
}

export const SECRETS: SecretMedal[] = [
  { id: 'saved-streak', title: 'Спасённый стрик', text: 'Заморозка сохранила стрик', test: (c) => c.freezesUsed >= 1 },
  { id: 'flawless', title: 'Без единой ошибки', text: 'Урок на 100%', test: (_, e) => !!e.perfectLesson },
  { id: 'midnight', title: 'Полночный путник', text: 'Урок после полуночи', test: (_, e) => e.lessonAt !== undefined && isMidnight(e.lessonAt) },
  // Появятся с главой V, Сфинксом и Эликсиром.
  { id: 'labyrinth', title: 'Выход из Лабиринта', text: 'Печать главы V', test: null },
  { id: 'sphinx', title: 'Взгляд Сфинкса', text: 'Дойти до Врат Хранилища', test: null },
  { id: 'keeper', title: 'Хранитель пути', text: 'Выпить Эликсир', test: null },
];

export interface MedalsState {
  lines: Partial<Record<LineId, LineRecord>>;
  secrets: Record<string, number>;
}

export type MedalGain =
  | { kind: 'line'; line: MedalLine; tier: Tier; reward: number }
  | { kind: 'secret'; secret: SecretMedal; reward: number };

/**
 * Новые ступени и тайные медали. Если счётчик перескочил несколько ступеней, каждая считается
 * отдельно со своей наградой. Уже записанные ступени не возвращаются, поэтому награда не выдаётся дважды.
 */
export function medalGains(c: MedalCounters, state: MedalsState, e: MedalEvent = {}): MedalGain[] {
  const out: MedalGain[] = [];
  for (const line of ACTIVE_LINES) {
    const v = line.value!(c);
    const rec = state.lines[line.id] ?? {};
    line.thresholds.forEach((t, i) => {
      const tier = TIERS[i];
      if (v >= t && rec[tier] === undefined) out.push({ kind: 'line', line, tier, reward: TIER_INFO[tier].reward });
    });
  }
  for (const s of SECRETS) {
    if (s.test && state.secrets[s.id] === undefined && s.test(c, e)) out.push({ kind: 'secret', secret: s, reward: SECRET_REWARD });
  }
  return out;
}

/** Записать полученное в состояние. */
export function applyGains(state: MedalsState, gains: MedalGain[], now: number): MedalsState {
  const lines = { ...state.lines };
  const secrets = { ...state.secrets };
  for (const g of gains) {
    if (g.kind === 'line') lines[g.line.id] = { ...lines[g.line.id], [g.tier]: now };
    else secrets[g.secret.id] = now;
  }
  return { lines, secrets };
}

export const gainsReward = (gains: MedalGain[]) => gains.reduce((n, g) => n + g.reward, 0);

/** Строка прогресса: «312 / 500 слов до бронзы» или «3000 слов, все ступени». */
export function progressText(line: MedalLine, value: number): string {
  const next = nextThreshold(line, value);
  if (!next) return `${value} ${plural(value, line.unit)}, все ступени`;
  return `${value} / ${next.at} ${plural(next.at, line.unit)} до ${TIER_INFO[next.tier].gen}`;
}

/** Лучшие медали для профиля: выше ступень, при равенстве раньше полученная. */
export function bestMedals(state: MedalsState, n = 3): { line: MedalLine; tier: Tier }[] {
  return LINES.flatMap((line) => {
    const rec = state.lines[line.id];
    const tier = currentTier(rec);
    return tier ? [{ line, tier, at: rec![tier]! }] : [];
  })
    .sort((a, b) => TIERS.indexOf(b.tier) - TIERS.indexOf(a.tier) || a.at - b.at)
    .slice(0, n)
    .map(({ line, tier }) => ({ line, tier }));
}

/** Подпись для списка: «Бронзовая медаль «Словесник»». */
export function gainTitle(g: MedalGain): string {
  return g.kind === 'line' ? `${TIER_INFO[g.tier].adj} медаль «${g.line.title}»` : `Тайная медаль «${g.secret.title}»`;
}

/** Закреплённое слово: интервал не меньше трёх недель. */
export const SOLID_INTERVAL_DAYS = 21;
