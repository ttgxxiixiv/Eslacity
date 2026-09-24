import { db, type BuildingRow } from '../db/db';
import { dayKey } from '../domain/srs';
import type { Settings } from './settings';
import { useCity } from './city';
import { useProgress } from './progress';
import { useSettings } from './settings';

export async function bootstrap(): Promise<void> {
  const [cards, buildings, meta, day, grammar] = await Promise.all([
    db.cards.toArray(),
    db.buildings.toArray(),
    db.meta.toArray(),
    db.days.get(dayKey(Date.now())),
    db.grammar.toArray(),
  ]);
  const m = Object.fromEntries(meta.map((r) => [r.key, r.value]));

  if (!buildings.some((b) => b.locationId === 'cafe')) {
    // Кафе открыто с самого начала.
    const cafe: BuildingRow = { locationId: 'cafe', level: 1, lastCollectedAt: Date.now() };
    buildings.push(cafe);
    await db.buildings.put(cafe);
  }

  useProgress.getState().hydrate({ cards, day, xpTotal: (m.xpTotal as number) ?? 0, grammar });
  useCity.getState().hydrate({ coins: (m.coins as number) ?? 0, buildings });
  useSettings.getState().hydrate(m.settings as Partial<Settings> | undefined);
}

export async function resetProgress(): Promise<void> {
  await db.delete();
  location.reload();
}
