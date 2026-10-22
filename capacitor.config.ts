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
    // Строка состояния и навигация спрятаны (MainActivity), страница всегда с viewport-fit=cover: отступ от выреза
    // камеры она берёт из env(safe-area-inset-top). Подсказка `cover` — чтобы WebView не перекладывал вёрстку при запуске.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    // Напоминания (задача 10.4): белый силуэт медальона в строке состояния (`scripts/build-icons.py`), цвет — золото.
    LocalNotifications: { smallIcon: 'ic_stat_eslacity', iconColor: '#d4a017' },
  },
};

export default config;
