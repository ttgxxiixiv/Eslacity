import { create } from 'zustand';
import { db, type BuildingRow } from '../db/db';
import { persist } from '../db/persist';
import { LOCATION_BY_ID } from '../content/locations';
import type { LocationId } from '../content/schema';
import { upgradeCost } from '../domain/economy';

interface CityState {
  coins: number;
  buildings: Partial<Record<LocationId, BuildingRow>>;
  hydrate(p: { coins: number; buildings: BuildingRow[] }): void;
  addCoins(n: number): void;
  /** Улучшить здание на 1 уровень. false, если не хватает монет. */
  upgrade(id: LocationId): boolean;
}

export const useCity = create<CityState>((set, get) => ({
  coins: 0,
  buildings: {},

  hydrate({ coins, buildings }) {
    set({ coins, buildings: Object.fromEntries(buildings.map((b) => [b.locationId, b])) });
  },

  addCoins(n) {
    if (!n) return;
    const coins = get().coins + n;
    set({ coins });
    persist(() => db.meta.put({ key: 'coins', value: coins }));
  },

  upgrade(id) {
    const b = get().buildings[id];
    const level = b?.level ?? 0;
    if (level >= 5) return false;
    const cost = level === 0 ? LOCATION_BY_ID[id].unlockCost : upgradeCost(LOCATION_BY_ID[id], level + 1);
    const { coins } = get();
    if (coins < cost) return false;
    const row: BuildingRow = { locationId: id, level: level + 1, lastCollectedAt: b?.lastCollectedAt ?? Date.now() };
    set({ coins: coins - cost, buildings: { ...get().buildings, [id]: row } });
    persist(() =>
      db.transaction('rw', db.meta, db.buildings, async () => {
        await db.meta.put({ key: 'coins', value: coins - cost });
        await db.buildings.put(row);
      }),
    );
    return true;
  },
}));
