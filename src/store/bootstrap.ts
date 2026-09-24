import { db, type BuildingRow } from '../db/db';
import { dayKey } from '../domain/srs';
import type { Settings } from './settings';
import { useCity } from './city';
import { useProgress } from './progress';
import { useSettings } from './settings';
import { useMotivation, type MotivationData } from './motivation';

export async function bootstrap(): Promise<void> {
  // Просим браузер не вычищать IndexedDB при нехватке места: иначе прогресс может пропасть.
  navigator.storage?.persist?.().catch(() => {});

  const since = dayKey(Date.now() - 14 * 86_400_000);
  const [cards, buildings, meta, days, grammar] = await Promise.all([
    db.cards.toArray(),
    db.buildings.toArray(),
    db.meta.toArray(),
    db.days.where('date').aboveOrEqual(since).toArray(),
    db.grammar.toArray(),
  ]);
  const m = Object.fromEntries(meta.map((r) => [r.key, r.value]));

  if (!buildings.some((b) => b.locationId === 'cafe')) {
    // Кафе открыто с самого начала.
    const cafe: BuildingRow = { locationId: 'cafe', level: 1, lastCollectedAt: Date.now() };
    buildings.push(cafe);
    await db.buildings.put(cafe);
  }

  useProgress.getState().hydrate({ cards, days, xpTotal: (m.xpTotal as number) ?? 0, grammar });
  useCity.getState().hydrate({ coins: (m.coins as number) ?? 0, buildings });
  useSettings.getState().hydrate(m.settings as Partial<Settings> | undefined);
  useMotivation.getState().hydrate(m.motivation as Partial<MotivationData> | undefined);
  useMotivation.getState().settle();
  useMotivation.getState().evaluate();
}

export async function resetProgress(): Promise<void> {
  await db.delete();
  location.reload();
}
