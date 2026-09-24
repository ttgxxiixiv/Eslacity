import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { dayKey, dayNumber } from '../domain/srs';
import { isAlive } from '../domain/streak';
import { useMotivation } from '../store/motivation';

export function StatsBar() {
  const coins = useCity((s) => s.coins);
  const day = useProgress((s) => s.day);
  const goal = useSettings((s) => s.dailyGoal);
  const xp = day.date === dayKey(Date.now()) ? day.xp : 0;
  const ratio = Math.min(1, xp / goal);
  const streak = useMotivation((s) => s.streak);
  const alive = isAlive(streak, dayNumber(Date.now()));
  return (
    <div className="flex items-center gap-3 px-5 pt-4">
      <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-semibold shadow-sm">
        <span>🪙</span>
        <span className="tabular-nums">{coins}</span>
      </div>
      <div
        className={`flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-semibold shadow-sm ${alive ? '' : 'text-stone-400'}`}
        title="Стрик"
      >
        <span className={alive ? '' : 'grayscale'}>🔥</span>
        <span className="tabular-nums">{alive ? streak.count : 0}</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div
            className={`h-full w-full origin-left rounded-full ${ratio >= 1 ? 'bg-ok' : 'bg-amber-500'}`}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>
        <span className="text-sm tabular-nums text-stone-600">
          {xp}/{goal} XP
        </span>
      </div>
    </div>
  );
}
