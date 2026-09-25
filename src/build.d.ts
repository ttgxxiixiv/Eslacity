interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

declare const __APP_BUILD__: BuildInfo;
