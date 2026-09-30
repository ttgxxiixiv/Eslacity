import { LANG, LANGS, type Lang } from '../lang';

/**
 * Запись `meta` из базы другого языка (задача 8.4: в профиле второго языка видна медаль «Мудрец» первого).
 * База открывается напрямую, без Dexie, только на чтение; если её нет, она не создаётся.
 */
export function readMetaOf(lang: Lang, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(LANGS[lang].db);
    } catch {
      resolve(undefined);
      return;
    }
    // Базы не было: отменяем создание.
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onerror = () => resolve(undefined);
    req.onsuccess = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('meta')) {
        idb.close();
        resolve(undefined);
        return;
      }
      const get = idb.transaction('meta').objectStore('meta').get(key);
      get.onsuccess = () => {
        resolve((get.result as { value?: unknown } | undefined)?.value);
        idb.close();
      };
      get.onerror = () => {
        resolve(undefined);
        idb.close();
      };
    };
  });
}

/** Другие языки, в которых герой уже выпил Эликсир. */
export async function sagesElsewhere(): Promise<Lang[]> {
  const others = (Object.keys(LANGS) as Lang[]).filter((l) => l !== LANG);
  const found = await Promise.all(others.map(async (l) => ((await readMetaOf(l, 'sphinx')) as { elixir?: number } | undefined)?.elixir !== undefined));
  return others.filter((_, i) => found[i]);
}
