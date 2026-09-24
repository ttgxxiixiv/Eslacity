import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ECONOMY } from '../config';
import { ACHIEVEMENTS } from '../domain/achievements';
import { challengeFor, weekKey, weeklyProgress } from '../domain/goals';
import { dayKey, dayNumber } from '../domain/srs';
import { canBuyFreeze, isAlive } from '../domain/streak';
import { useCity } from '../store/city';
import { useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { Button, Screen, TopBar } from '../components/ui';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function ProfileScreen() {
  const now = Date.now();
  const today = dayNumber(now);
  const streak = useMotivation((s) => s.streak);
  const unlocked = useMotivation((s) => s.achievements);
  const weeklyClaimed = useMotivation((s) => s.weeklyClaimed);
  const coins = useCity((s) => s.coins);
  const days = useProgress((s) => s.days);
  const cards = useProgress((s) => s.cards);
  const goal = useSettings((s) => s.dailyGoal);
  const [claimed, setClaimed] = useState(0);

  const alive = isAlive(streak, today);
  const challenge = challengeFor(today);
  const progress = weeklyProgress(challenge, Object.values(days), today);
  const done = progress >= challenge.target;
  const isClaimed = weeklyClaimed === weekKey(today);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const ts = now - (6 - i) * 86_400_000;
    const d = days[dayKey(ts)];
    return { xp: d?.xp ?? 0, met: !!d?.goalMet, label: WEEKDAYS[(new Date(ts).getDay() + 6) % 7] };
  });
  const maxXp = Math.max(goal, ...last7.map((d) => d.xp));

  return (
    <Screen>
      <TopBar
        title="Профиль"
        back={false}
        right={
          <Link to="/settings" aria-label="Настройки" className="press flex h-10 w-10 items-center justify-center text-xl">
            ⚙️
          </Link>
        }
      />
      <div className="flex flex-col gap-4 px-5 pb-6">
        <section className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm">
          <div className={`text-5xl ${alive ? '' : 'grayscale'}`}>🔥</div>
          <div className="flex-1">
            <div className="text-2xl font-bold">
              {alive ? streak.count : 0} {plural(alive ? streak.count : 0, ['день', 'дня', 'дней'])}
            </div>
            <div className="text-sm text-stone-500">
              Рекорд: {streak.best} · заморозки: {'🧊'.repeat(streak.freezes) || 'нет'}
            </div>
          </div>
        </section>
        <Button
          variant="secondary"
          disabled={!canBuyFreeze(streak, coins)}
          onClick={() => useMotivation.getState().buyFreeze()}
        >
          🧊 Купить заморозку за 🪙 {ECONOMY.freezeCost}
          {streak.freezes >= ECONOMY.maxFreezes && <span className="block text-xs font-normal">максимум {ECONOMY.maxFreezes}</span>}
        </Button>
        <p className="-mt-2 px-1 text-xs text-stone-500">
          Заморозка тратится сама, если вы пропустили день, и сохраняет стрик.
        </p>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">Неделя</h2>
          <div className="mt-3 flex h-28 items-end gap-2">
            {last7.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className={`w-full origin-bottom rounded-t-md ${d.met ? 'bg-ok' : 'bg-amber-400'}`}
                    style={{ height: '100%', transform: `scaleY(${d.xp / maxXp})` }}
                  />
                </div>
                <span className="text-xs text-stone-500">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-500">XP по дням, зелёный — цель {goal} XP выполнена.</p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Челлендж недели</h2>
            <span className="text-sm text-stone-500">🪙 {challenge.reward}</span>
          </div>
          <p className="mt-1">{challenge.text}</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full w-full origin-left rounded-full bg-brand"
              style={{ transform: `scaleX(${Math.min(1, progress / challenge.target)})` }}
            />
          </div>
          <div className="mt-1 text-sm text-stone-500 tabular-nums">
            {Math.min(progress, challenge.target)} / {challenge.target}
          </div>
          {done && !isClaimed && (
            <Button className="mt-3 w-full" onClick={() => setClaimed(useMotivation.getState().claimWeekly())}>
              Забрать награду
            </Button>
          )}
          {isClaimed && <p className="mt-2 text-sm text-ok">Награда получена{claimed ? `: +${claimed} 🪙` : ''}</p>}
        </section>

        <Link to="/words" className="press flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm">
          <span className="font-bold">📖 Мои слова</span>
          <span className="text-stone-500">{Object.keys(cards).length} →</span>
        </Link>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Достижения</h2>
            <span className="text-sm text-stone-500">
              {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const got = !!unlocked[a.id];
              return (
                <li key={a.id} className={`rounded-2xl p-2 text-center ${got ? 'bg-amber-50' : 'bg-stone-50'}`}>
                  <div className={`text-3xl ${got ? '' : 'opacity-30 grayscale'}`}>{a.emoji}</div>
                  <div className={`mt-1 text-xs leading-tight font-semibold ${got ? '' : 'text-stone-400'}`}>{a.title}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-stone-500">{a.text}</div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Screen>
  );
}

function plural(n: number, forms: [string, string, string]) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
