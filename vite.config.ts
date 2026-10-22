import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { glossIndex, parseLemmas, tokens } from './scripts/vocab-lib';
import { CHAPTERS } from './src/content/vocabPlan';
import { buildSayIndex, sayRecords } from './src/domain/say';
import { APP_NAME, appDescription } from './src/appInfo';
import { PROFILES } from './src/langs';
import { courseCacheName, courseListPath, courseStamp, type CourseList } from './src/domain/course';

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

// Описание приложения — по открытым курсам (задача 20.1): то же в манифесте и в <meta name="description">.
const APP_DESCRIPTION = appDescription(Object.values(PROFILES).filter((p) => p.released).map((p) => p.name));

// Индекс уроков грамматики для карты: только язык, id, район, номер и название.
// Сами уроки грузятся лениво, по чанку на язык и район.
const CONTENT_DIR = join(import.meta.dirname, 'src', 'content');
const LANG_KEYS = Object.keys(PROFILES);

/**
 * Язык модуля сборки (задача 20.4): контент `src/content/<язык>/`, портреты `src/assets/portraits/<язык>/`,
 * индекс слов `virtual:word-index/<язык>`. Остальное общее.
 */
function langOfModule(id: string): string | null {
  const m = id.replace(/\\/g, '/').match(/\/src\/(?:content|assets\/portraits)\/([^/]+)\/|^\0virtual:word-index\/([^/?]+)$/);
  const lang = m?.[1] ?? m?.[2];
  return lang && LANG_KEYS.includes(lang) ? lang : null;
}

/** Язык чанка: все его модули одного языка. Такой чанк кладётся в `assets/<язык>/` и не входит в precache. */
function langOfChunk(ids: string[]): string | null {
  const langs = new Set(ids.map(langOfModule));
  return langs.size === 1 ? [...langs][0] : null;
}
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
/** Пары выражений по языкам (id → id пары в другом регистре): для поручений «Эхо». */
function pairIndex() {
  const out: Record<string, Record<string, string>> = {};
  for (const { lang, dir } of wordDirs()) {
    out[lang] = Object.fromEntries(
      readdirSync(dir)
        .filter((x) => x.endsWith('.json'))
        .flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { words: { id: string; pair?: string }[] }).words)
        .flatMap((w) => (w.pair ? [[w.id, w.pair] as const] : [])),
    );
  }
  return out;
}
/** id выражений уровня 7 (слова с `kind`): в итогах пути они считаются отдельно от слов. */
function expressionIndex() {
  const out: Record<string, string[]> = {};
  for (const { lang, dir } of wordDirs()) {
    out[lang] = readdirSync(dir)
      .filter((x) => x.endsWith('.json'))
      .flatMap((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { words: { id: string; kind?: string }[] }).words)
      .flatMap((w) => (w.kind ? [w.id] : []));
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
      existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
    // У слов свитка level всегда 1, а по сложности они на уровне своей главы (как в валидаторе):
    // иначе «querido» из свитка III перебил бы «querer» уровня 2 при общей лемме.
    const words = [
      ...read(join(CONTENT_DIR, lang, 'words')).flatMap((f) => f.words),
      ...read(join(CONTENT_DIR, lang, 'scrolls')).flatMap((f: { chapter: number; words: { level: number }[] }) =>
        f.words.map((w) => ({ ...w, level: CHAPTERS[f.chapter - 1]?.levels[0] ?? 99 })),
      ),
    ];
    const forms = parseLemmas(readFileSync(join(import.meta.dirname, 'scripts', 'data', `lemmas-${lang}.tsv`), 'utf8'));
    g = glossIndex(words, forms, lang);
    glossers.set(lang, g);
  }
  return g;
}
function withAutoGloss(code: string, lang: string): string {
  const data = JSON.parse(code) as { scenes: { lines: { es: string; fem?: { es?: string } }[]; gloss?: Record<string, string>; auto?: Record<string, string> }[] };
  const g = glosser(lang);
  for (const sc of data.scenes) {
    const auto: Record<string, string> = {};
    // Женские формы реплик (`fem`) путница тоже нажимает.
    for (const t of sc.lines.flatMap((l) => [...tokens(l.es, lang), ...tokens(l.fem?.es ?? '', lang)])) {
      const ru = sc.gloss?.[t] ? undefined : g(t);
      if (ru) auto[t] = ru;
    }
    sc.auto = auto;
  }
  return JSON.stringify(data);
}

/** Книги Летописца (задача 12.4): переводы слов курса в абзацах, как у сцен. */
function withBookGloss(code: string, lang: string): string {
  const data = JSON.parse(code) as { books: { paragraphs: { es: string }[]; gloss?: Record<string, string>; auto?: Record<string, string> }[] };
  const g = glosser(lang);
  for (const b of data.books) {
    const auto: Record<string, string> = {};
    for (const t of b.paragraphs.flatMap((p) => tokens(p.es, lang))) {
      const ru = b.gloss?.[t] ? undefined : g(t);
      if (ru) auto[t] = ru;
    }
    b.auto = auto;
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
        // Контент языков — в своих папках (задача 20.4): `assets/<язык>/…`, кэш курса качается отдельно от оболочки.
        chunkFileNames: (chunk) => {
          // Заглушка динамического импорта модуля из группы (`core-<язык>`, уроки района) своих модулей не имеет.
          const lang = langOfChunk(chunk.moduleIds.length ? chunk.moduleIds : [chunk.facadeModuleId ?? '']);
          return lang ? `assets/${lang}/[name]-[hash].js` : 'assets/[name]-[hash].js';
        },
        assetFileNames: (asset) => {
          const lang = langOfChunk(asset.originalFileNames.map((f) => `/${f}`));
          return lang && asset.originalFileNames.length ? `assets/${lang}/[name]-[hash][extname]` : 'assets/[name]-[hash][extname]';
        },
        // Зависимости меняются реже кода приложения: отдельный чанк лучше кэшируется.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/]/ },
            {
              // Маленькие файлы курса (задача 20.3): один чанк на язык, грузится только язык курса.
              name: (id) => {
                const m = id.match(/content[\\/]([^\\/]+)[\\/](?:npcs|chronicler|guardians|diary|prologue)\.json$/);
                return m ? `core-${m[1]}` : null;
              },
              test: /content[\\/][^\\/]+[\\/](?:npcs|chronicler|guardians|diary|prologue)\.json$/,
            },
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
    {
      name: 'app-description',
      transformIndexHtml: (html) => html.replace('%APP_DESCRIPTION%', APP_DESCRIPTION),
    },
    tailwindcss(),
    {
      name: 'scene-gloss',
      enforce: 'pre',
      transform(code, id) {
        const m = id.match(/content[\\/]([^\\/]+)[\\/]scenes[\\/][^\\/]+\.json$/);
        if (m) return { code: withAutoGloss(code, m[1]), map: null };
        const b = id.match(/content[\\/]([^\\/]+)[\\/]books[\\/][^\\/]+\.json$/);
        return b ? { code: withBookGloss(code, b[1]), map: null } : null;
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
      // Свой модуль на язык (задача 16.2): `virtual:word-index/es`, грузится только индекс языка курса.
      resolveId(id) {
        return id.startsWith('virtual:word-index/') ? `\0${id}` : null;
      },
      load(id) {
        if (!id.startsWith('\0virtual:word-index/')) return null;
        const lang = id.slice('\0virtual:word-index/'.length);
        for (const { lang, dir } of wordDirs()) {
          this.addWatchFile(dir);
          if (existsSync(join(CONTENT_DIR, lang, 'scrolls'))) this.addWatchFile(join(CONTENT_DIR, lang, 'scrolls'));
          if (existsSync(join(CONTENT_DIR, lang, 'missions'))) this.addWatchFile(join(CONTENT_DIR, lang, 'missions'));
        }
        const of = <T,>(all: Record<string, T>, empty: T) => JSON.stringify(all[lang] ?? empty);
        return [
          `export default ${of(wordIndex(), {})};`,
          `export const PHRASES = ${of(phraseIndex(), [])};`,
          `export const PAIRS = ${of(pairIndex(), {})};`,
          `export const EXPRESSIONS = ${of(expressionIndex(), [])};`,
          `export const SCROLLS = ${of(scrollIndex(), {})};`,
          `export const MISSIONS = ${of(missionIndex(), {})};`,
        ].join('\n');
      },
    },
    {
      // Произношение для озвучки (задача 15.4): записи с полем say из всего контента языка.
      name: 'say-index',
      resolveId(id) {
        return id === 'virtual:say-index' ? '\0virtual:say-index' : null;
      },
      load(id) {
        if (id !== '\0virtual:say-index') return null;
        const files = (dir: string): string[] =>
          readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
        const out: Record<string, ReturnType<typeof buildSayIndex>> = {};
        for (const { lang } of wordDirs()) {
          const dir = join(CONTENT_DIR, lang);
          this.addWatchFile(dir);
          out[lang] = buildSayIndex(files(dir).flatMap((f) => sayRecords(JSON.parse(readFileSync(f, 'utf8')))));
        }
        return `export default ${JSON.stringify(out)};`;
      },
    },
    {
      // Списки файлов курсов (задача 20.4): `course/<язык>-<метка>.json`, по ним страница и service worker
      // докачивают курс в его кэш. Сборка печатает размер каждого курса рядом с размером precache (оболочки).
      name: 'course-files',
      generateBundle(_, bundle) {
        const stamp = courseStamp(BUILD.builtAt);
        const lines: string[] = [];
        for (const lang of LANG_KEYS) {
          const files = Object.values(bundle).filter((f) => f.fileName.startsWith(`assets/${lang}/`));
          if (!files.length) continue;
          const bytes = files.reduce((n, f) => n + (f.type === 'chunk' ? Buffer.byteLength(f.code) : typeof f.source === 'string' ? Buffer.byteLength(f.source) : f.source.byteLength), 0);
          const list: CourseList = { lang, stamp, files: files.map((f) => f.fileName).sort(), bytes };
          this.emitFile({ type: 'asset', fileName: courseListPath(lang, stamp), source: JSON.stringify(list) });
          lines.push(`  ${lang}: ${files.length} файлов, ${(bytes / 1024).toFixed(0)} KiB`);
        }
        if (lines.length) this.info(`Курсы (кэш курса, не в precache):\n${lines.join('\n')}`);
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
      includeAssets: ['favicon-32.png', 'favicon-16.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: 'Eslacity',
        description: APP_DESCRIPTION,
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
        // Большие иконки нужны только при установке приложения (с сетью): в precache их не держим.
        // Контент языков (задача 20.4) не в precache: курс качается в свой кэш (`src/lib/course.ts`, `course-sw.js`).
        globIgnores: ['icons/icon-512.png', 'icons/maskable-512.png', ...LANG_KEYS.map((l) => `assets/${l}/**`)],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Напоминания (задача 10.4): обработчик periodicsync и нажатия на уведомление.
        // Курс (задача 20.4): при установке новой версии докачать файлы курса, пока работает прежняя.
        importScripts: ['reminder-sw.js', 'course-sw.js'],
        // Музыка (public/music, около мегабайта на тему) не в precache: качается при первом запросе и остаётся в кэше.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/music/'),
            handler: 'CacheFirst',
            options: { cacheName: 'eslacity-music', expiration: { maxEntries: 12 } },
          },
          // Файлы курса: из его кэша, а чего там нет — из сети с записью в кэш.
          ...LANG_KEYS.map((lang) => ({
            urlPattern: new RegExp(`/assets/${lang}/`),
            handler: 'CacheFirst' as const,
            options: { cacheName: courseCacheName(lang), matchOptions: { ignoreVary: true } },
          })),
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
