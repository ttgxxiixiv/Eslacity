import { Capacitor, registerPlugin } from '@capacitor/core';
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

/** Свой плагин приложения (`android/.../ApkUpdatePlugin.java`): скачать APK и открыть установщик Android. */
const ApkUpdate = registerPlugin<{ install(o: { url: string }): Promise<{ size: number }> }>('ApkUpdate');

/**
 * Обновить приложение: скачать APK версии `version` с сайта и открыть установщик. Номер версии в адресе — чтобы
 * не взять старый файл из кэша. Без разрешения ставить приложения Android откроет настройки, а ошибка скажет,
 * что нажать «Обновить» нужно ещё раз.
 */
export async function installApk(version: string): Promise<void> {
  try {
    await ApkUpdate.install({ url: `${APK_URL}?v=${version}` });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'permission') throw new Error('Разрешите Eslacity устанавливать приложения и нажмите «Обновить» ещё раз.');
    throw new Error(err.message ?? 'Не удалось скачать обновление');
  }
}
