import { create } from 'zustand';
import { db, type BuildingRow } from '../db/db';
import { persist } from '../db/persist';
import { LOCATION_BY_ID } from '../content/locations';
import type { LocationId } from '../content/schema';
import { collectIncome, upgradeCost } from '../domain/economy';
import { discountedCost } from '../domain/reputation';

interface CityState {
  coins: number;
  buildings: Partial<Record<LocationId, BuildingRow>>;
  hydrate(p: { coins: number; buildings: BuildingRow[] }): void;
  addCoins(n: number): void;
  /** Открыть здание или улучшить на 1 уровень. rep — очки репутации жителя места (скидка). false, если не хватает монет. */
  upgrade(id: LocationId, now?: number, rep?: number): boolean;
  /** Собрать доход с одного здания. Возвращает число монет. */
  collect(id: LocationId, now?: number): number;
  collectAll(now?: number): number;
}

function save(coins: number, rows: BuildingRow[]) {
  persist(() =>
    db.transaction('rw', db.meta, db.buildings, async () => {
      await db.meta.put({ key: 'coins', value: coins });
      await db.buildings.bulkPut(rows);
    }),
  );
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

  upgrade(id, now = Date.now(), rep = 0) {
    const b = get().buildings[id];
    const level = b?.level ?? 0;
    if (level >= 5) return false;
    const base = upgradeCost(LOCATION_BY_ID[id], level + 1);
    // Открытие места по полной цене, улучшение — со скидкой жителя.
    const cost = level === 0 ? base : discountedCost(base, rep);
    // Накопленное по старой ставке забираем до улучшения, чтобы новая ставка не считалась задним числом.
    const income = b ? collectIncome(b, now) : { coins: 0, lastCollectedAt: now };
    const coins = get().coins + income.coins;
    if (coins < cost) return false;
    const row: BuildingRow = { locationId: id, level: level + 1, lastCollectedAt: income.lastCollectedAt };
    set({ coins: coins - cost, buildings: { ...get().buildings, [id]: row } });
    save(coins - cost, [row]);
    return true;
  },

  collect(id, now = Date.now()) {
    const b = get().buildings[id];
    if (!b) return 0;
    const r = collectIncome(b, now);
    if (!r.coins) return 0;
    const row = { ...b, lastCollectedAt: r.lastCollectedAt };
    const coins = get().coins + r.coins;
    set({ coins, buildings: { ...get().buildings, [id]: row } });
    save(coins, [row]);
    return r.coins;
  },

  collectAll(now = Date.now()) {
    const rows: BuildingRow[] = [];
    let total = 0;
    const buildings = { ...get().buildings };
    for (const b of Object.values(buildings)) {
      if (!b) continue;
      const r = collectIncome(b, now);
      if (!r.coins) continue;
      total += r.coins;
      const row = { ...b, lastCollectedAt: r.lastCollectedAt };
      buildings[b.locationId] = row;
      rows.push(row);
    }
    if (!total) return 0;
    const coins = get().coins + total;
    set({ coins, buildings });
    save(coins, rows);
    return total;
  },
}));
