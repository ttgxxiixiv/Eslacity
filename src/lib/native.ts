import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

/** Игра запущена как приложение для Android (APK, Capacitor), а не в браузере. */
export const NATIVE = Capacitor.isNativePlatform();

/** Сайт игры: оттуда приложение для Android узнаёт о новой версии и скачивает APK. */
export const SITE = 'https://ttgxxiixiv.github.io/Eslacity/';
/** APK на сайте: его кладёт туда сборка (`.github/workflows/pages.yml`). */
export const APK_FILE = 'eslacity.apk';
export const APK_URL = SITE + APK_FILE;

/**
 * Настройка приложения для Android при запуске. Страница без `viewport-fit=cover`: тогда WebView сам отступает от
 * строки состояния и навигации, и шапка экранов не уходит под часы. Системная кнопка «Назад» листает экраны
 * игры назад, а на главной сворачивает приложение.
 */
export function initNative() {
  if (!NATIVE) return;
  const meta = document.querySelector('meta[name="viewport"]');
  meta?.setAttribute('content', (meta.getAttribute('content') ?? '').replace(/,?\s*viewport-fit=cover/, ''));
  void App.addListener('backButton', () => {
    const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#';
    if (atHome) void App.minimizeApp();
    else history.back();
  });
}

/**
 * Сохранить JSON в файл. В браузере файл скачивается, а WebView приложения для Android скачивание не умеет:
 * там файл ложится в «Документы/Eslacity». Возвращает, куда сохранено (только в приложении).
 */
export async function saveJsonFile(obj: unknown, filename: string, download: (obj: unknown, name: string) => void): Promise<string | undefined> {
  if (!NATIVE) {
    download(obj, filename);
    return undefined;
  }
  // Android 10 и старше просит разрешение на запись в общие папки, новые версии — нет.
  await Filesystem.requestPermissions().catch(() => {});
  const path = `Eslacity/${filename}`;
  await Filesystem.writeFile({ path, data: JSON.stringify(obj), directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  return `Документы/${path}`;
}
