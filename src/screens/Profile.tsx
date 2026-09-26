import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ECONOMY } from '../config';
import { ACTIVE_LINES, bestMedals, TIER_INFO, TIERS } from '../domain/medals';
import { challengeFor, weekKey, weeklyProgress } from '../domain/goals';
import { dayKey, dayNumber } from '../domain/srs';
import { canBuyFreeze, isAlive } from '../domain/streak';
import { useCity } from '../store/city';
import { useMotivation } from '../store/motivation';
import { currentJourney, useJourney } from '../store/journey';
import { chapterById } from '../domain/chapters';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { Button, Screen, TopBar } from '../components/ui';
import { CURRENT } from '../lib/update';
import { LevelCard } from '../components/HeroLevel';
import { Medal } from '../components/Medal';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function ProfileScreen() {
  const now = Date.now();
  const today = dayNumber(now);
  const streak = useMotivation((s) => s.streak);
  const medals = useMotivation((s) => s.medals);
  const best = bestMedals(medals);
  const weeklyClaimed = useMotivation((s) => s.weeklyClaimed);
  const coins = useCity((s) => s.coins);
  const days = useProgress((s) => s.days);
  const cards = useProgress((s) => s.cards);
  const goal = useSettings((s) => s.dailyGoal);
  const fragments = useJourney((s) => s.fragments);
  const journey = useMemo(() => currentJourney(), [fragments, cards]);
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
        <LevelCard />
        <Link to="/journey-map" className="press flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm" data-testid="profile-map">
          <span className="text-3xl" aria-hidden>
            🗺️
          </span>
          <div className="flex-1">
            <div className="font-bold">Карта странствий</div>
            <div className="text-sm text-stone-500 tabular-nums">
              Глава {chapterById(journey.current)?.roman} · {journey.chapters[journey.current - 1].places.filter((p) => p.got).length} / 20 обрывков
            </div>
          </div>
          <span className="text-stone-500">→</span>
        </Link>
        <Link to="/medals" className="press flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm" data-testid="best-medals">
          <div className="flex-1">
            <div className="font-bold">Зал медалей</div>
            <div className="text-sm text-stone-500 tabular-nums">
              {ACTIVE_LINES.reduce((n, l) => n + Object.keys(medals.lines[l.id] ?? {}).length, 0)}/{ACTIVE_LINES.length * TIERS.length}
            </div>
          </div>
          {best.length ? (
            best.map((b) => <Medal key={b.line.id} icon={b.line.id} tier={b.tier} size={48} label={`${b.line.title}: ${TIER_INFO[b.tier].ru}`} />)
          ) : (
            <span className="text-sm text-stone-400">пока нет медалей</span>
          )}
          <span className="text-stone-500">→</span>
        </Link>
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
          <div className="mt-3 h-2.5 overflow-hidden rounded bg-wood p-[2px]">
            <div
              className="h-full w-full origin-left rounded-sm bg-gold"
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


        <Link to="/settings" className="press py-2 text-center text-sm text-stone-400">
          Версия {CURRENT.version} · о приложении и обновления →
        </Link>
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
