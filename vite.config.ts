import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
          groups: [{ name: 'vendor', test: /node_modules[\\/]/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
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
        background_color: '#fafaf9',
        theme_color: '#c2410c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Весь контент (слова, уроки) лежит в JS-чанках, так что после первой загрузки всё работает офлайн.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
