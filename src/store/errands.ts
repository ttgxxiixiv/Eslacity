import { create } from 'zustand';
import { LOCATIONS } from '../content/locations';
import { NPC_BY_LOCATION, npcFor } from '../content/npcs';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { errandReward, planErrands, SCROLL_PLACE, type Errand } from '../domain/errands';
import { rankIndex, RANKS, type Rank } from '../domain/reputation';
import { dayNumber } from '../domain/srs';
import { useCity } from './city';
import { useProgress } from './progress';

export interface ErrandsData {
  /** День, на который собран план. */
  day: number;
  active: Errand[];
  /** Когда у места было последнее поручение. */
  last: Record<string, number>;
  /** Выполнено поручений за всё время: медаль «Посыльный». */
  done: number;
  /** Очки репутации у жителей (по id жителя). Шкала отношений — задача 3.6. */
  rep: Record<string, number>;
}

const EMPTY: ErrandsData = { day: 0, active: [], last: {}, done: 0, rep: {} };

interface ErrandsState extends ErrandsData {
  hydrate(d: Partial<ErrandsData> | undefined): void;
  /** Собрать поручения на сегодня, если день сменился. */
  refresh(now?: number): void;
  /** Поручение выполнено: награда и репутация. Возвращает награду или null, если поручения уже нет. */
  complete(id: string, now?: number): { coins: number; rep: number; rankUp: Rank | null } | null;
}

function save(s: ErrandsData) {
  const { day, active, last, done, rep } = s;
  persist(() => db.meta.put({ key: 'errands', value: { day, active, last, done, rep } }));
}

export const useErrands = create<ErrandsState>((set, get) => ({
  ...EMPTY,

  hydrate(d) {
    set({ ...EMPTY, ...d });
  },

  refresh(now = Date.now()) {
    const today = dayNumber(now);
    const s = get();
    // План собирается раз в день: выполнив все три, новых до завтра не ждём.
    if (s.day === today) return;
    const buildings = useCity.getState().buildings;
    const places: string[] = LOCATIONS.map((l) => l.id).filter((id) => (buildings[id]?.level ?? 0) > 0 && NPC_BY_LOCATION[id]);
    // Летописец идёт с героем всегда; поручение у него будет, только если свитку пора повториться.
    places.push(SCROLL_PLACE);
    const active = planErrands({
      today,
      places,
      cards: Object.values(useProgress.getState().cards),
      active: s.active,
      last: s.last,
      phrases: (loc) => npcFor(loc)?.errands.length ?? 1,
    });
    const last = { ...s.last };
    for (const e of active) if (e.day === today) last[e.location] = today;
    set({ day: today, active, last });
    save(get());
  },

  complete(id) {
    const s = get();
    const e = s.active.find((x) => x.id === id);
    if (!e) return null;
    const reward = errandReward(e);
    const npc = npcFor(e.location);
    const before = npc ? (s.rep[npc.id] ?? 0) : 0;
    const rep = npc ? { ...s.rep, [npc.id]: before + reward.rep } : s.rep;
    set({ active: s.active.filter((x) => x.id !== id), done: s.done + 1, rep });
    useCity.getState().addCoins(reward.coins);
    save(get());
    const after = rankIndex(before + reward.rep);
    return { ...reward, rankUp: npc && after > rankIndex(before) ? RANKS[after] : null };
  },
}));
