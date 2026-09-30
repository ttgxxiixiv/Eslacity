import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { dayKey, dayNumber } from '../domain/srs';
import { isAlive } from '../domain/streak';
import { useMotivation } from '../store/motivation';
import { LevelBadge } from './HeroLevel';
import { heroLevel } from '../domain/heroLevel';
import coinPic from '../assets/home/coin.webp';
import flamePic from '../assets/home/flame.webp';
// Огонёк в макете серый: горящий вариант строит scripts/build-flame-lit.py.
import flameLitPic from '../assets/home/flame-lit.webp';
import heartEmpty from '../assets/home/heart-empty.webp';
import heartFull from '../assets/home/heart-full.webp';
import heartHalf from '../assets/home/heart-half.webp';

const HEARTS = 5;

/** Сердечко дневной цели: целое, половина или пустое. Картинки вырезаны из макета главной. */
function Heart({ fill }: { fill: number }) {
  const src = fill >= 1 ? heartFull : fill > 0 ? heartHalf : heartEmpty;
  return <img src={src} alt="" width={19} height={19} className="block h-[19px] w-[19px]" aria-hidden />;
}

/** Верхняя панель в духе RPG: кошелёк, огонь стрика, уровень персонажа и сердечки дневной цели. */
export function StatsBar() {
  const coins = useCity((s) => s.coins);
  const day = useProgress((s) => s.day);
  const goal = useSettings((s) => s.dailyGoal);
  const xp = day.date === dayKey(Date.now()) ? day.xp : 0;
  const ratio = Math.min(1, xp / goal);
  const streak = useMotivation((s) => s.streak);
  const today = dayNumber(Date.now());
  const alive = isAlive(streak, today);
  // Огонёк горит, только когда дневная цель сегодня уже выполнена; до этого он серый.
  const litToday = streak.lastDay === today;
  const xpTotal = useProgress((s) => s.xpTotal);
  const lvl = heroLevel(xpTotal);
  // Дневная цель — пять сердечек, с половинками.
  const halves = Math.floor(ratio * HEARTS * 2);
  return (
    <div className="home-font px-[7px] pt-3">
      <div className="home-topbar flex h-[55px] items-center gap-2 pr-[19px] pl-[21px] text-[#f1dfb5]">
        <div className="flex items-center gap-1 text-[21px] font-medium [text-shadow:0_1px_1px_#1a0f07]">
          <img src={coinPic} alt="" width={21} height={21} className="h-[21px] w-[21px]" aria-hidden />
          <span className="tabular-nums">{coins}</span>
        </div>
        <div
          className={`ml-2 flex items-center gap-1 text-[21px] font-medium [text-shadow:0_1px_1px_#1a0f07] ${alive ? '' : 'opacity-50'}`}
          title={litToday ? 'Стрик: сегодня цель выполнена' : 'Стрик: сегодня цель ещё не выполнена'}
          data-testid="streak"
          data-lit={litToday ? '1' : '0'}
        >
          <img src={litToday ? flameLitPic : flamePic} alt="" width={20} height={23} className="h-[23px] w-[20px]" data-flame={litToday ? 'lit' : 'grey'} aria-hidden />
          <span className="tabular-nums">{alive ? streak.count : 0}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LevelBadge stone />
          <div className="flex flex-col" title="Дневная цель">
            <div className="flex gap-px" aria-label={`Дневная цель: ${xp} из ${goal} XP`}>
              {Array.from({ length: HEARTS }, (_, i) => (
                <Heart key={i} fill={Math.max(0, Math.min(2, halves - i * 2)) / 2} />
              ))}
            </div>
            {/* Прогресс уровня героя под сердечками. */}
            <div
              className="mt-[3px] h-[9px] w-full overflow-hidden rounded-[3px] border border-[#6e5230] bg-[#1f160e] p-px"
              role="progressbar"
              aria-label={`До уровня ${lvl.level + 1}: ${lvl.into} из ${lvl.need} XP`}
              aria-valuemin={0}
              aria-valuemax={lvl.need}
              aria-valuenow={lvl.into}
              data-testid="level-bar"
            >
              <div
                className="h-full w-full origin-left rounded-[1px] bg-[linear-gradient(180deg,#f7d36b,#d9a531)]"
                style={{ transform: `scaleX(${lvl.need ? lvl.into / lvl.need : 0})`, transition: 'transform 300ms ease-out' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
