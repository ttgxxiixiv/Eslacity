import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Приложение для Android (APK): та же сборка `dist/` внутри WebView, работает без сети. Проект `android/`
 * создан `npx cap add android`, APK собирает GitHub Actions (`.github/workflows/pages.yml`) и кладёт на сайт.
 */
const config: CapacitorConfig = {
  appId: 'io.github.ttgxxiixiv.eslacity',
  appName: 'Eslacity',
  webDir: 'dist',
  plugins: {
    // Страница без viewport-fit=cover: WebView получает отступы от строки состояния и навигации, шапка не уходит под часы.
    SystemBars: { insetsHandling: 'native' },
  },
};

export default config;
