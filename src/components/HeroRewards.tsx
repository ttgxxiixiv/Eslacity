import { CLOAK_LABEL, CLOAK_ORDER, unlockLevel } from '../domain/rewards';
import { useRewards } from '../store/rewards';
import { WALKER } from './walkerArt';
import { LANTERNS, lanternOf, unlockedLanterns } from '../domain/decor';
import { TIER_INFO } from '../domain/medals';
import { useMotivation } from '../store/motivation';
import { HeroSprite } from './Hero';

/** Награды уровней героя в профиле (задача 9.2): жетоны подсказки и выбор накидки путника. */
export function HeroRewards() {
  const rec = useRewards((s) => s.rec);
  const medals = useMotivation((s) => s.medals);
  const openLanterns = unlockedLanterns(medals);
  const lantern = lanternOf(medals, rec.lantern);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="hero-rewards">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Награды уровней</h2>
        <span className="text-sm text-stone-600 tabular-nums" data-testid="hint-count">
          💡 Жетонов: {rec.hints}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        Жетон открывает первую букву, когда нужно написать слово; такой ответ засчитывается как «почти». Новые жетоны, режимы блица и
        накидки даёт уровень героя: от мешковины до парчи, последняя — ближе к концу пути.
      </p>
      <div className="mt-3 text-sm font-semibold text-stone-700">Накидка путника</div>
      <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Накидка путника">
        {CLOAK_ORDER.map((id) => {
          const open = rec.cloaks.includes(id);
          const picked = rec.cloak === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={!open}
              onClick={() => useRewards.getState().setCloak(id)}
              className={`press flex flex-col items-center gap-1 rounded-xl border-2 bg-[#2b1e14] px-1 py-2 text-[11px] leading-tight text-[#f1dfb5] disabled:opacity-40 ${picked ? 'border-gold' : 'border-transparent'}`}
              data-testid={`cloak-${id}`}
            >
              <img src={WALKER[id]} alt="" className="h-[36px] w-auto" />
              <span>{open ? CLOAK_LABEL[id] : `ур. ${unlockLevel({ cloak: id })}`}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-sm font-semibold text-stone-700">Фонарь путника</div>
      <p className="mt-1 text-xs text-stone-500">Свет фонаря зажигают медали: бронзовая, серебряная, золотая, бриллиантовая — в любой линии.</p>
      <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Фонарь путника">
        {LANTERNS.map((l) => {
          const open = openLanterns.includes(l);
          const picked = lantern.id === l.id;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={!open}
              onClick={() => useRewards.getState().setLantern(l.id)}
              className={`press flex flex-col items-center gap-1 rounded-xl border-2 bg-[#2b1e14] px-0.5 py-2 text-[10px] leading-tight text-[#f1dfb5] disabled:opacity-40 ${picked ? 'border-gold' : 'border-transparent'}`}
              data-testid={`lantern-${l.id}`}
            >
              <HeroSprite walking={false} flame={l.flame} glow={l.glow} />
              <span>{open || !l.tier ? l.title : TIER_INFO[l.tier].ru}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
