export const LOCATION_IDS = [
  'cafe', 'market', 'supermarket', 'restaurant', 'home', 'park', 'clothes', 'pharmacy',
  'school', 'post', 'bank', 'barber', 'gym', 'station', 'beach', 'office', 'hotel',
  'hospital', 'airport', 'police',
] as const;

export type LocationId = (typeof LOCATION_IDS)[number];

export type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'interj' | 'phrase';
export type Gender = 'm' | 'f';
export type Cefr = 'A1' | 'A2' | 'B1';
export type BuildingLevel = 1 | 2 | 3 | 4 | 5;

export interface Example {
  es: string;
  ru: string;
}

export interface Word {
  /** Уникален во всём контенте: "<location>.<slug>" */
  id: string;
  /**
   * Форма на изучаемом языке (поле исторически называется es): "el café", "il caffè".
   * У существительных всегда с определённым артиклем. Для испанского — вариант Испании.
   */
  es: string;
  ru: string;
  pos: Pos;
  /** Обязателен для существительных. */
  gender?: Gender;
  level: BuildingLevel;
  cefr: Cefr;
  example: Example;
  /** Другие принимаемые ответы при вводе. */
  alt?: string[];
  /** Форма для латиноамериканского варианта, если отличается. */
  latam?: string;
  plural?: string;
}

export interface LocationWords {
  location: LocationId;
  words: Word[];
}

export interface LocationMeta {
  id: LocationId;
  ru: string;
  emoji: string;
  unlockCost: number;
}

export type District = 'A1' | 'A2' | 'B1.1' | 'B1.2' | 'B2';

export type TheoryBlock =
  | { kind: 'text'; md: string }
  | { kind: 'tip'; md: string }
  | {
      kind: 'table';
      caption?: string;
      head: string[];
      rows: { cells: string[]; region?: 'es' }[];
    };

/** region: 'es' — только для испанского варианта (формы vosotros). */
/**
 * id — устойчивый номер упражнения `<lessonId>.<n>`: проставляется скриптом `scripts/add-exercise-ids.ts`
 * и никогда не пересчитывается, по нему журнал ответов и повторение правил помнят историю.
 */
export type GrammarExercise = { id: string; explain: string; region?: 'es' } & (
  | { kind: 'choose'; prompt: string; ru?: string; options: string[]; answer: number }
  | { kind: 'gap'; sentence: string; ru: string; options: string[]; answer: number }
  | { kind: 'truefalse'; statement: string; ru?: string; answer: boolean }
);

export interface GrammarLesson {
  id: string;
  district: District;
  order: number;
  title: string;
  theory: TheoryBlock[];
  examples: Example[];
  exercises: GrammarExercise[];
  region?: 'es';
}

/** Детали портрета жителя поверх одежды и причёски. */
export type NpcExtra =
  | 'apron' | 'glasses' | 'headphones' | 'chefhat' | 'mustache' | 'beard' | 'cap'
  | 'tie' | 'headband' | 'badge' | 'stethoscope';

export interface NpcLook {
  /** Тон кожи 1–4, от светлого к тёмному. */
  skin: 1 | 2 | 3 | 4;
  hair: string;
  style: 'short' | 'long' | 'bun' | 'curly' | 'bald';
  outfit: string;
  pants: string;
  extra: NpcExtra[];
}

/** Житель места: свой в каждом языке. */
export interface Npc {
  id: string;
  name: string;
  location: LocationId;
  role: string;
  gender: 'm' | 'f';
  /** Характер одной строкой: для будущих диалогов и миссий. */
  character: string;
  /** Приветствие на изучаемом языке (поле es) и перевод. */
  greeting: Example;
  /** Голос: высота и скорость речи для speechSynthesis. */
  voice: { pitch: number; rate: number };
  look: NpcLook;
  /**
   * 3–4 формулировки поручения голосом жителя: {n} — число заданий, {слов} или {правил} — слово в нужной форме.
   * У учительницы школы — про правила.
   */
  errands: string[];
  /** Тёплые приветствия по репутации: Приятель, Друг, Верный друг. */
  warm: Example[];
}

export interface NpcsFile {
  npcs: Npc[];
}

/** Свиток земли: общие слова главы без места (docs/GAME.md, «Словарный запас»). Их просит выучить Летописец. */
export interface ScrollFile {
  chapter: number;
  /** id вида `scroll<глава>.<slug>`, level не используется (всегда 1), cefr — уровень главы. */
  words: Word[];
}

/** Летописец: житель без места, идёт по пути рядом с героем. Поручения — слова свитков. */
export type Chronicler = Omit<Npc, 'location'>;

/** Откуда грузятся слова: место или свиток главы (`scroll1`). */
export type WordSource = LocationId | `scroll${number}`;

/**
 * Готовая фраза ситуации: то, что герой говорит жителю места (docs/GAME.md, этап «Сюжетные миссии»).
 * Необязательные слова — в скобках: «(Yo) quiero un café». Фразы в словарный запас не входят.
 */
export interface Phrase {
  /** `ph:<место>.<slug>`: приставка, как у правил, чтобы фраза не смешалась со словами места. */
  id: string;
  es: string;
  ru: string;
  /** Уровень места, с которого фраза доступна (1–7). */
  level: number;
  /** Другие верные варианты, тоже со скобками. */
  alt?: string[];
  /** Пояснение: когда так говорят, чем вариант отличается. */
  note?: string;
  /** id урока грамматики, на котором держится фраза. */
  grammar?: string;
}

export interface LocationPhrases {
  location: LocationId;
  phrases: Phrase[];
}

/** Реплика сцены: `npc` — житель сцены, `hero` — герой, или id другого жителя. */
export interface SceneLine {
  who: string;
  es: string;
  ru: string;
}

/** Вопрос на понимание: по-русски, первый вариант не обязательно верный — верный по `answer`. */
export interface SceneQuestion {
  q: string;
  options: string[];
  answer: number;
}

/**
 * Сцена: разговор с жителем места в главе (docs/GAME.md, «Жители и миссии»). Основа сюжетной миссии (4.5).
 * `gloss` — перевод слов, которых нет в словаре мест: их показывает нажатие на слово.
 */
export interface Scene {
  /** `sc:<место>.<глава>` */
  id: string;
  chapter: number;
  /** id жителя места. */
  npc: string;
  lines: SceneLine[];
  questions: SceneQuestion[];
  gloss?: Record<string, string>;
  /** Переводы слов реплик из словаря курса: достраиваются при сборке (vite), в JSON их нет. */
  auto?: Record<string, string>;
}

export interface LocationScenes {
  location: LocationId;
  scenes: Scene[];
}

/** Реплика жителя в миссии. */
export interface MissionSay {
  kind: 'say';
  es: string;
  ru: string;
  /** Следующий узел; нет — миссия закончилась. */
  next?: string;
}

/** Ответ героя: одна из фраз места. Каждая фраза ведёт по своей ветке. */
export interface MissionAnswer {
  kind: 'answer';
  /** Что герой хочет сказать, по-русски: подсказка к ответу. */
  task: string;
  /** Верные ответы: id фразы места и узел, куда он ведёт. Первая ветка — основная (для плиток и подсказки). */
  branches: { phrase: string; next: string }[];
  /** Реакция жителя на неверный ответ: смешная, но понятная. */
  wrong: { es: string; ru: string };
}

export type MissionNode = MissionSay | MissionAnswer;

/**
 * Сюжетная миссия жителя на главу (docs/GAME.md, «Жители и миссии»): сначала сцена-разговор, потом диалог,
 * где герой отвечает фразами места. Засчитывается при 80% верных ответов.
 */
export interface Mission {
  /** `ms:<место>.<глава>` */
  id: string;
  chapter: number;
  npc: string;
  /** Сцена-вступление (`sc:<место>.<глава>`). */
  scene?: string;
  /** С чего начинается диалог. */
  start: string;
  nodes: Record<string, MissionNode>;
}

export interface LocationMissions {
  location: LocationId;
  missions: Mission[];
}
