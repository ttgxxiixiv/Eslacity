import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LOCATIONS } from '../content/locations';
import { hasContent } from '../content';
import { dueCards } from '../domain/srs';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { StatsBar } from '../components/Stats';
import { Screen } from '../components/ui';

export function Home() {
  const cards = useProgress((s) => s.cards);
  const buildings = useCity((s) => s.buildings);
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

      <h2 className="px-5 pt-6 pb-2 font-semibold text-stone-600">Город</h2>
      <div className="grid grid-cols-4 gap-2 px-5">
        {LOCATIONS.map((l) => {
          const lvl = buildings[l.id]?.level ?? 0;
          const active = hasContent(l.id);
          const inner = (
            <>
              <span className={`text-3xl ${lvl ? '' : 'opacity-40 grayscale'}`}>{l.emoji}</span>
              <span className="mt-1 line-clamp-1 text-[11px] leading-tight">{l.ru}</span>
              {lvl > 0 && <span className="text-[10px] text-stone-500">ур. {lvl}</span>}
            </>
          );
          const cls = 'flex aspect-square flex-col items-center justify-center rounded-2xl bg-white p-1 text-center shadow-sm';
          return active ? (
            <Link key={l.id} to={`/loc/${l.id}`} className={`press ${cls}`}>
              {inner}
            </Link>
          ) : (
            <div key={l.id} className={`${cls} opacity-60`}>
              {inner}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
