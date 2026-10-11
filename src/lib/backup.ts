import { downloadJson, exportBackup } from '../db/backup';
import { autoBackupDue, backupFileName, staleAutoBackups } from '../domain/backupPlan';
import { LANG } from '../lang';
import { useBackup } from '../store/backup';
import { useProgress } from '../store/progress';
import { deleteSavedFile, listSavedFiles, NATIVE, saveJsonFile } from './native';

/** Копии прогресса на устройстве (задача 16.7). Решения — `src/domain/backupPlan.ts`, запись — `useBackup`. */

/** Сохранить копию сейчас: в браузере файл скачивается, в приложении ложится в «Документы/Eslacity». */
export async function saveBackupNow(now = Date.now()): Promise<string | undefined> {
  const where = await saveJsonFile(await exportBackup(), backupFileName(LANG, now), downloadJson);
  useBackup.getState().saved(now);
  return where;
}

/** Автокопия в приложении: раз в неделю при запуске, хранятся последние четыре. В браузере ничего не делает. */
export async function autoBackup(now = Date.now()): Promise<void> {
  if (!NATIVE) return;
  const hasProgress = Object.keys(useProgress.getState().cards).length > 0;
  if (!autoBackupDue(useBackup.getState().rec, hasProgress, now)) return;
  await saveJsonFile(await exportBackup(), backupFileName(LANG, now, true), downloadJson);
  useBackup.getState().saved(now, true);
  for (const name of staleAutoBackups(await listSavedFiles(), LANG)) await deleteSavedFile(name);
}

/** Дал ли браузер постоянное хранилище. Нет API — undefined (тогда и предупреждать не о чем). */
export async function storagePersisted(): Promise<boolean | undefined> {
  if (NATIVE) return true;
  try {
    return (await navigator.storage?.persisted?.()) ?? undefined;
  } catch {
    return undefined;
  }
}
