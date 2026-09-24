import { db } from './db';

const TABLES = ['cards', 'buildings', 'grammar', 'days', 'meta'] as const;

export interface Backup {
  app: 'eslacity';
  version: 1;
  exportedAt: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

export async function exportBackup(): Promise<Backup> {
  const entries = await Promise.all(TABLES.map(async (t) => [t, await db.table(t).toArray()] as const));
  return { app: 'eslacity', version: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) as Backup['data'] };
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackup(text: string): Backup {
  const b = JSON.parse(text) as Backup;
  if (b?.app !== 'eslacity' || b.version !== 1 || typeof b.data !== 'object') throw new Error('Это не файл прогресса Eslacity');
  for (const t of TABLES) if (!Array.isArray(b.data[t])) throw new Error(`В файле нет таблицы ${t}`);
  return b;
}

/** Полностью заменить прогресс содержимым резервной копии. */
export async function importBackup(b: Backup): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(b.data[t]);
    }
  });
}
