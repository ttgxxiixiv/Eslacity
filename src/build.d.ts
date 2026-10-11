interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

declare const __APP_BUILD__: BuildInfo;

declare module 'virtual:grammar-index' {
  const index: {
    lang: import('./lang').Lang;
    id: string;
    district: import('./content/schema').District;
    order: number;
    title: string;
  }[];
  export default index;
}

declare module 'virtual:say-index' {
  /** Язык → словарь произношения для озвучки (задача 15.4, `src/domain/say.ts`). */
  const index: Record<string, import('./domain/say').SayIndex>;
  export default index;
}

/** Индекс слов одного языка: `virtual:word-index/es`, `virtual:word-index/it` (задача 16.2). */
declare module 'virtual:word-index/*' {
  /** Место → уровень → id слов без префикса места (`cafe.te` записан как `te`). */
  const index: Record<string, Record<number, string[]>>;
  export default index;
  /** id слов с частью речи phrase. */
  export const PHRASES: string[];
  /** id выражения → id его пары в другом регистре. */
  export const PAIRS: Record<string, string>;
  /** id выражений уровня 7. */
  export const EXPRESSIONS: string[];
  /** Глава → id слов свитка земли. */
  export const SCROLLS: Record<number, string[]>;
  /** Место → главы, для которых есть сюжетная миссия. */
  export const MISSIONS: Record<string, number[]>;
}
