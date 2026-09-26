import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { glossIndex, parseLemmas, tokens } from './scripts/vocab-lib';

// Данные о сборке: показываются в настройках и лежат в version.json для проверки обновлений.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}
const BUILD = { version: pkg.version, commit: gitCommit(), builtAt: new Date().toISOString() };

// Индекс уроков грамматики для карты: только язык, id, район, номер и название.
// Сами уроки грузятся лениво, по чанку на язык и район.
const CONTENT_DIR = join(import.meta.dirname, 'src', 'content');
const grammarDirs = () =>
  readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(CONTENT_DIR, e.name, 'grammar')))
    .map((e) => ({ lang: e.name, dir: join(CONTENT_DIR, e.name, 'grammar') }));
function grammarIndex() {
  const out: { lang: string; id: string; district: string; order: number; title: string }[] = [];
  for (const { lang, dir } of grammarDirs()) {
    for (const d of readdirSync(dir)) {
      for (const f of readdirSync(join(dir, d)).filter((x) => x.endsWith('.json'))) {
        const l = JSON.parse(readFileSync(join(dir, d, f), 'utf8'));
        out.push({ lang, id: l.id, district: l.district, order: l.order, title: l.title });
      }
    }
  }
  return out;
}

// Индекс слов для пути: какие слова в каком уровне места (id без префикса места, чтобы индекс был легче).
// Сами слова грузятся по местам.
const wordDirs = () =>
  readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(CONTENT_DIR, e.name, 'words')))
    .map((e) => ({ lang: e.name, dir: join(CONTENT_DIR, e.name, 'words') }));
/** id фраз по языкам: словарный запас считается без них. */
function phraseIndex() {
  const out: Record<string, string[]> = {};
  for (const { lang, dir } of wordDirs()) {
    out[lang] = readdirSync(dir)
      .filter((x) => x.endsWith('.json'))
      .flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { words: { id: string; pos: string }[] }).words)
      .filter((w) => w.pos === 'phrase')
      .map((w) => w.id);
  }
  return out;
}
function wordIndex() {
  const out: Record<string, Record<string, Record<number, string[]>>> = {};
  for (const { lang, dir } of wordDirs()) {
    const byLoc: Record<string, Record<number, string[]>> = (out[lang] = {});
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { location: string; words: { id: string; level: number }[] };
      const levels: Record<number, string[]> = (byLoc[data.location] = {});
      for (const w of data.words) (levels[w.level] ??= []).push(w.id.slice(data.location.length + 1));
    }
  }
  return out;
}

/** Миссии по языкам и местам: язык → место → главы, для которых миссия есть. Условие обрывка без загрузки миссий. */
function missionIndex() {
  const out: Record<string, Record<string, number[]>> = {};
  for (const { lang } of wordDirs()) {
    const dir = join(CONTENT_DIR, lang, 'missions');
    const byPlace: Record<string, number[]> = (out[lang] = {});
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { location: string; missions: { chapter: number }[] };
      byPlace[data.location] = data.missions.map((m) => m.chapter);
    }
  }
  return out;
}

/** Слова свитков земель по языкам и главам: язык → глава → id. */
function scrollIndex() {
  const out: Record<string, Record<number, string[]>> = {};
  for (const { lang } of wordDirs()) {
    const dir = join(CONTENT_DIR, lang, 'scrolls');
    const byChapter: Record<number, string[]> = (out[lang] = {});
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { chapter: number; words: { id: string }[] };
      byChapter[data.chapter] = data.words.map((w) => w.id);
    }
  }
  return out;
}

/**
 * Перевод слов сцены по нажатию: при сборке к каждой сцене добавляется `auto` — слово реплики → перевод
 * из словаря курса (по лемме, основе, спряжению). Таблицы лемм остаются в scripts/data и в приложение не попадают.
 */
const glossers = new Map<string, (t: string) => string | undefined>();
function glosser(lang: string) {
  let g = glossers.get(lang);
  if (!g) {
    const read = (dir: string) =>
      existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).words) : [];
    const words = [...read(join(CONTENT_DIR, lang, 'words')), ...read(join(CONTENT_DIR, lang, 'scrolls'))];
    const forms = parseLemmas(readFileSync(join(import.meta.dirname, 'scripts', 'data', `lemmas-${lang}.tsv`), 'utf8'));
    g = glossIndex(words, forms, lang);
    glossers.set(lang, g);
  }
  return g;
}
function withAutoGloss(code: string, lang: string): string {
  const data = JSON.parse(code) as { scenes: { lines: { es: string }[]; gloss?: Record<string, string>; auto?: Record<string, string> }[] };
  const g = glosser(lang);
  for (const sc of data.scenes) {
    const auto: Record<string, string> = {};
    for (const t of sc.lines.flatMap((l) => tokens(l.es))) {
      const ru = sc.gloss?.[t] ? undefined : g(t);
      if (ru) auto[t] = ru;
    }
    sc.auto = auto;
  }
  return JSON.stringify(data);
}

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(BUILD),
  },
  build: {
    rolldownOptions: {
      output: {
        // Зависимости меняются реже кода приложения: отдельный чанк лучше кэшируется.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/]/ },
            {
              // Один чанк на язык и район грамматики: grammar-es-a1, grammar-it-b11…
              name: (id) => {
                const m = id.match(/content[\\/]([^\\/]+)[\\/]grammar[\\/]([^\\/]+)[\\/]/);
                return m ? `grammar-${m[1]}-${m[2]}` : null;
              },
              test: /content[\\/][^\\/]+[\\/]grammar[\\/][^\\/]+[\\/][^\\/]+\.json$/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'scene-gloss',
      enforce: 'pre',
      transform(code, id) {
        const m = id.match(/content[\\/]([^\\/]+)[\\/]scenes[\\/][^\\/]+\.json$/);
        return m ? { code: withAutoGloss(code, m[1]), map: null } : null;
      },
    },
    {
      name: 'grammar-index',
      resolveId(id) {
        return id === 'virtual:grammar-index' ? '\0virtual:grammar-index' : null;
      },
      load(id) {
        if (id !== '\0virtual:grammar-index') return null;
        for (const { dir } of grammarDirs()) for (const d of readdirSync(dir)) this.addWatchFile(join(dir, d));
        return `export default ${JSON.stringify(grammarIndex())};`;
      },
    },
    {
      name: 'word-index',
      resolveId(id) {
        return id === 'virtual:word-index' ? '\0virtual:word-index' : null;
      },
      load(id) {
        if (id !== '\0virtual:word-index') return null;
        for (const { lang, dir } of wordDirs()) {
          this.addWatchFile(dir);
          if (existsSync(join(CONTENT_DIR, lang, 'scrolls'))) this.addWatchFile(join(CONTENT_DIR, lang, 'scrolls'));
          if (existsSync(join(CONTENT_DIR, lang, 'missions'))) this.addWatchFile(join(CONTENT_DIR, lang, 'missions'));
        }
        return [
          `export default ${JSON.stringify(wordIndex())};`,
          `export const PHRASES = ${JSON.stringify(phraseIndex())};`,
          `export const SCROLLS = ${JSON.stringify(scrollIndex())};`,
          `export const MISSIONS = ${JSON.stringify(missionIndex())};`,
        ].join('\n');
      },
    },
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD) });
      },
    },
    VitePWA({
      // Новая версия ставится по кнопке «Обновить», а не посреди урока.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Eslacity — испанский в городе',
        short_name: 'Eslacity',
        description: 'Испанский для русскоговорящих: строй город, учи слова и грамматику',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9d8ab',
        theme_color: '#3b2a1a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Весь контент (слова, уроки) лежит в JS-чанках, так что после первой загрузки всё работает офлайн.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
