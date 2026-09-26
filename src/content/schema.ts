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
}

export interface NpcsFile {
  npcs: Npc[];
}
