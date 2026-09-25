import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cachedLocation, loadLocation } from '../content';
import { DISTRICTS, lessonsOf } from '../content/grammar';
import { LOCATION_BY_ID, LOCATIONS } from '../content/locations';
import type { LocationId, Word } from '../content/schema';
import { type NextStep, nextStep, recentLocation } from '../domain/next';
import { dueCards } from '../domain/srs';
import { useNow } from '../lib/useNow';
import { CityGrid } from '../components/CityGrid';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { StatsBar } from '../components/Stats';
import { Screen } from '../components/ui';

type WordsMap = Partial<Record<LocationId, Word[]>>;

/** Слова открытых зданий: из кэша сразу, остальные догружаются. */
function useOpenWords(open: LocationId[]): WordsMap | null {
  const key = open.join(',');
  const [words, setWords] = useState<WordsMap | null>(() => {
    const m: WordsMap = {};
    for (const id of open) {
      const ws = cachedLocation(id);
      if (!ws) return null;
      m[id] = ws;
    }
    return m;
  });
  useEffect(() => {
    let alive = true;
    Promise.all(open.map(async (id) => [id, await loadLocation(id)] as const)).then((pairs) => {
      if (alive) setWords(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return words;
}

function newWordsLabel(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'новое слово';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'новых слова';
  return 'новых слов';
}

function ContinueCard({ step }: { step: NextStep }) {
  if (step.kind === 'done') {
    return (
      <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
        <h2 className="text-lg font-bold">Город построен</h2>
        <div className="text-sm text-stone-500">Все уроки пройдены, осталось повторять</div>
      </div>
    );
  }
  const meta = LOCATION_BY_ID[step.loc];
  let to: string;
  let sub: string;
  if (step.kind === 'learn') {
    to = `/learn/${step.loc}/${step.level}/${step.part}`;
    sub = `${meta.emoji} ${meta.ru} · уровень ${step.level} · урок ${step.part + 1}`;
    if (step.newWords) sub += ` · ${step.newWords} ${newWordsLabel(step.newWords)}`;
  } else {
    to = `/loc/${step.loc}`;
    const what = step.kind === 'upgrade' ? `улучшить до уровня ${step.toLevel}` : 'открыть';
    sub = `${meta.emoji} ${meta.ru}: ${what} за 🪙 ${step.cost}`;
    if (step.missing) sub += `, не хватает ${step.missing}`;
  }
  return (
    <Link
      to={to}
      data-testid="continue"
      className="press flex items-center justify-between gap-3 rounded-xl bg-brand px-5 py-4 text-white shadow-md"
    >
      <div className="min-w-0">
        <div className="font-pixel text-xs tracking-widest text-gold uppercase">Текущий квест</div>
        <div className="font-pixel text-2xl font-bold">Продолжить</div>
        <div className="text-sm opacity-90">{sub}</div>
      </div>
      <div className="bob font-pixel text-3xl text-gold" aria-hidden>
        ▶
      </div>
    </Link>
  );
}

export function Home() {
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const buildings = useCity((s) => s.buildings);
  const coins = useCity((s) => s.coins);
  // Счётчик пересчитывается и после полуночи, если приложение не закрывали.
  const now = useNow(60_000);
  const due = useMemo(() => dueCards(Object.values(cards), now).length, [cards, now]);
  const learned = Object.keys(cards).length;

  const open = useMemo(
    () => LOCATIONS.filter((l) => (buildings[l.id]?.level ?? 0) > 0).map((l) => l.id),
    [buildings],
  );
  const words = useOpenWords(open);
  const step = useMemo(() => {
    if (!words) return null;
    const levels = Object.fromEntries(open.map((id) => [id, buildings[id]!.level]));
    return nextStep({ locations: LOCATIONS, levels, words, cards, coins, recent: recentLocation(cards) });
  }, [words, open, buildings, cards, coins]);

  const nextGrammar = useMemo(() => {
    for (const d of DISTRICTS) {
      const l = lessonsOf(d.id).find((x) => !grammar[x.id]);
      if (l) return { ...l, district: d.title };
    }
    return null;
  }, [grammar]);

  return (
    <Screen>
      <StatsBar />
      <div className="px-3 pt-4">
        {/* Пока слова грузятся, держим место, чтобы экран не прыгал. */}
        {step ? <ContinueCard step={step} /> : <div className="h-[104px] rounded-xl bg-stone-200" />}
        {nextGrammar && (
          <Link
            to={`/grammar/${nextGrammar.id}`}
            className="press mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-5 py-3 shadow-sm"
          >
            <span className="min-w-0 truncate font-semibold">📜 {nextGrammar.title}</span>
            <span className="shrink-0 text-sm font-semibold text-stone-500">{nextGrammar.district}</span>
          </Link>
        )}
        <Link
          to="/review"
          className="press mt-3 flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm"
        >
          <div>
            <div className="font-pixel text-lg">Повторить</div>
            <div className="text-sm text-stone-500">{due ? `${due} слов на сегодня` : 'На сегодня всё повторено'}</div>
          </div>
          <div className={`text-3xl font-bold tabular-nums ${due ? 'text-brand' : 'text-stone-400'}`}>{due}</div>
        </Link>
        <Link
          to="/blitz"
          className="press mt-3 flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm"
        >
          <span className="font-pixel text-lg">⚡ Блиц</span>
          <span className="text-sm text-stone-500">60 секунд · {learned} слов в запасе</span>
        </Link>
      </div>

      <CityGrid />
    </Screen>
  );
}
