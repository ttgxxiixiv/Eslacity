import type { CloakId } from '../config';
import { CLOAK_LABEL, unlockLevel } from '../domain/rewards';
import { useRewards } from '../store/rewards';
import { WALKER } from './walkerArt';

/** Награды уровней героя в профиле (задача 9.2): жетоны подсказки и выбор плаща путника. */
export function HeroRewards() {
  const rec = useRewards((s) => s.rec);
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
        плащи даёт уровень героя.
      </p>
      <div className="mt-3 text-sm font-semibold text-stone-700">Плащ путника</div>
      <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Плащ путника">
        {(Object.keys(WALKER) as CloakId[]).map((id) => {
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
              <img src={WALKER[id]} alt="" className="h-[36px] w-[25px]" />
              <span>{open ? CLOAK_LABEL[id] : `ур. ${unlockLevel({ cloak: id })}`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
