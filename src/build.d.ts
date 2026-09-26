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

declare module 'virtual:word-index' {
  /** Язык → место → уровень → id слов без префикса места (`cafe.te` записан как `te`). */
  const index: Record<string, Record<string, Record<number, string[]>>>;
  export default index;
  /** Язык → id слов с частью речи phrase. */
  export const PHRASES: Record<string, string[]>;
  /** Язык → глава → id слов свитка земли. */
  export const SCROLLS: Record<string, Record<number, string[]>>;
  /** Язык → место → главы, для которых есть сюжетная миссия. */
  export const MISSIONS: Record<string, Record<string, number[]>>;
}
