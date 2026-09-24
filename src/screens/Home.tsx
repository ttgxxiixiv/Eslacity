import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dueCards } from '../domain/srs';
import { CityGrid } from '../components/CityGrid';
import { useProgress } from '../store/progress';
import { StatsBar } from '../components/Stats';
import { Screen } from '../components/ui';

export function Home() {
  const cards = useProgress((s) => s.cards);
  const due = useMemo(() => dueCards(Object.values(cards), Date.now()).length, [cards]);
  const learned = Object.keys(cards).length;

  return (
    <Screen>
      <StatsBar />
      <div className="px-5 pt-5">
        <Link
          to="/review"
          className={`press flex items-center justify-between rounded-3xl px-5 py-4 text-white shadow-md ${due ? 'bg-brand' : 'bg-stone-400'}`}
        >
          <div>
            <div className="text-lg font-bold">Повторить</div>
            <div className="text-sm opacity-90">{due ? `${due} слов на сегодня` : 'На сегодня всё повторено'}</div>
          </div>
          <div className="text-3xl font-bold tabular-nums">{due}</div>
        </Link>
        <Link
          to="/blitz"
          className="press mt-3 flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm"
        >
          <span className="font-semibold">⚡ Блиц 60 секунд</span>
          <span className="text-sm text-stone-500">{learned} слов в запасе</span>
        </Link>
      </div>

      <CityGrid />
    </Screen>
  );
}
