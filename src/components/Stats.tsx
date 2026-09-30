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
import { DailyRoad } from './DailyRoad';

/** Верхняя панель в духе RPG: кошелёк, огонь стрика, уровень персонажа и дневной переход (цель дня). */
export function StatsBar() {
  const coins = useCity((s) => s.coins);
  const day = useProgress((s) => s.day);
  const goal = useSettings((s) => s.dailyGoal);
  const xp = day.date === dayKey(Date.now()) ? day.xp : 0;
  const streak = useMotivation((s) => s.streak);
  const today = dayNumber(Date.now());
  const alive = isAlive(streak, today);
  // Огонёк горит, только когда дневная цель сегодня уже выполнена; до этого он серый.
  const litToday = streak.lastDay === today;
  const xpTotal = useProgress((s) => s.xpTotal);
  const lvl = heroLevel(xpTotal);
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
          <div className="flex w-[128px] min-w-0 flex-col">
            <DailyRoad xp={xp} goal={goal} lit={litToday} />
            {/* Прогресс уровня героя под дорогой. */}
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
