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
