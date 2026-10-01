import { useEffect, useState } from 'react';
import fireLit from '../assets/home/road-fire-lit.webp';
import fireOut from '../assets/home/road-fire-out.webp';
import stoneLit from '../assets/home/road-stone-lit.webp';
import stonePic from '../assets/home/road-stone.webp';
import { WALKER } from './walkerArt';
import { useRewards } from '../store/rewards';
import { ROAD_STONES, roadState } from '../domain/dailyRoad';

/** Края полосы дороги (розетки) при показе, в CSS-пикселях: срез 31 и 32 из картинки 494×39, показ в треть. */
const CAP_L = 10.3;
const CAP_R = 10.7;
/** Место под костёр справа от дороги. */
const FIRE_W = 18;

/**
 * Дневной переход в верхней панели (замена сердечек): дорога с верстовыми камнями, путник идёт по ней по мере
 * опыта за день, у цели — костёр привала. Картинки режет `scripts/build-road-art.py` из `docs/design/daily-road.png`.
 * `lit` — цель дня уже засчитана стрику: костёр горит, даже если цель потом подняли в настройках.
 */
export function DailyRoad({ xp, goal, lit }: { xp: number; goal: number; lit: boolean }) {
  const { ratio, stones, camp } = roadState(xp, goal);
  const cloak = useRewards((s) => s.rec.cloak);
  const burning = camp || lit;
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(false), 3000);
    return () => clearTimeout(t);
  }, [tip]);
  const label = `Дневной переход: ${xp} из ${goal} XP`;
  // Пройденная дорога показывается до места путника: правый край срезается на непройденную часть пути.
  const clip = ratio >= 1 ? undefined : `inset(0 calc((100% - ${CAP_L + CAP_R}px) * ${1 - ratio} + ${CAP_R}px) 0 0)`;
  return (
    <button
      type="button"
      onClick={() => setTip(!tip)}
      className="relative block h-[22px] w-full"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={goal}
      aria-valuenow={Math.min(xp, goal)}
      data-testid="daily-road"
      data-camp={burning ? '1' : '0'}
    >
      <span className="absolute bottom-0 left-0 h-[13px]" style={{ right: FIRE_W - 4 }}>
        <span className="road-bar absolute inset-0" />
        <span className="road-bar road-bar-full absolute inset-0" style={{ clipPath: clip }} />
        {/* Дорожка между розетками: камни и путник стоят на ней долями пути. */}
        <span className="absolute inset-y-0" style={{ left: CAP_L, right: CAP_R }}>
          {ROAD_STONES.map((s, i) => (
            <img
              key={s}
              src={stones[i] ? stoneLit : stonePic}
              alt=""
              className="absolute bottom-[3px] h-[12px] w-[9px] -translate-x-1/2"
              style={{ left: `${s * 100}%` }}
              data-passed={stones[i] ? '1' : '0'}
            />
          ))}
          <img
            src={WALKER[cloak]}
            alt=""
            className="absolute bottom-[2px] h-[18px] w-[13px] -translate-x-1/2 transition-[left] duration-500 ease-out"
            style={{ left: `${ratio * 100}%` }}
            data-testid="road-walker"
            data-cloak={cloak}
          />
        </span>
      </span>
      <img
        src={burning ? fireLit : fireOut}
        alt=""
        className={`absolute right-0 bottom-0 ${burning ? 'h-[22px] w-[20px]' : 'h-[16px] w-[19px]'}`}
        data-testid="road-fire"
        data-lit={burning ? '1' : '0'}
      />
      {tip && (
        <span
          role="status"
          className="absolute top-[26px] right-0 z-20 w-max max-w-[200px] rounded-lg border border-[#8a6a3a] bg-[#2b1e14] px-2 py-1 text-left text-[13px] leading-tight text-[#f1dfb5] shadow-lg"
          data-testid="road-tip"
        >
          {label}
          <br />
          {burning ? 'Привал: цель дня выполнена.' : 'У костра цель дня выполнена.'}
        </span>
      )}
    </button>
  );
}
