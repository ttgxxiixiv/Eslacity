import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cachedLocation, loadLocation } from '../content';
import { DISTRICTS, lessonsOf } from '../content/grammar';
import { LOCATION_BY_ID, LOCATIONS } from '../content/locations';
import type { LocationId, Npc, Word } from '../content/schema';
import { type NextStep, nextStepWithLimit, recentLocation } from '../domain/next';
import { chapterById, chapterOfLevel, isDistrictOpen, isLevelOpen, nearestGoal } from '../domain/chapters';
import { plural } from '../domain/medals';
import { discountedCost } from '../domain/reputation';
import { useErrands } from '../store/errands';
import { NPC_BY_LOCATION } from '../content/npcs';
import { NpcPortrait } from '../components/NpcPortrait';
import { useSettings } from '../store/settings';
import { currentJourney, useJourney } from '../store/journey';
import { dayKey, dueCards } from '../domain/srs';
import { splitCards, wordIds } from '../domain/itemId';
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
  if (step.kind === 'chapter') {
    const next = chapterById(step.next);
    const prev = chapterById(step.next - 1);
    return (
      <div className="rounded-3xl bg-white px-5 py-4 shadow-sm" data-testid="chapter-wait">
        <h2 className="text-lg font-bold">Глава {prev?.roman} почти пройдена</h2>
        <div className="text-sm text-stone-500">
          Соберите все обрывки карты и печать главы {prev?.roman}, чтобы открыть главу {next?.roman}: {next?.land}.
        </div>
      </div>
    );
  }
  if (step.kind === 'errands') {
    const sub =
      step.reason === 'limit'
        ? `Новых слов на сегодня хватит. Жители просят помочь вспомнить: ${step.due} ${plural(step.due, ['слово', 'слова', 'слов'])}`
        : `Накопилось ${step.due} ${plural(step.due, ['слово', 'слова', 'слов'])} к повтору — сначала помогите жителям`;
    const then = step.then.kind === 'learn' ? step.then : null;
    return (
      <div>
        <Link
          to="/errands"
          data-testid="continue"
          data-kind="errands"
          className="press flex items-center justify-between gap-3 rounded-xl bg-brand px-5 py-4 text-white shadow-md"
        >
          <div className="min-w-0">
            <div className="font-pixel text-xs tracking-widest text-gold uppercase">Текущий квест</div>
            <div className="font-pixel text-2xl font-bold">Поручения</div>
            <div className="text-sm opacity-90">{sub}</div>
          </div>
          <div className="bob font-pixel text-3xl text-gold" aria-hidden>
            ▶
          </div>
        </Link>
        {then && (
          <Link
            to={`/learn/${then.loc}/${then.level}/${then.part}`}
            className="mt-1 block text-center text-sm text-stone-500 underline"
            data-testid="learn-anyway"
          >
            Всё равно учить новые слова
          </Link>
        )}
      </div>
    );
  }
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
  let npc: Npc | undefined;
  let label = 'Текущий квест';
  if (step.kind === 'learn') {
    to = `/learn/${step.loc}/${step.level}/${step.part}`;
    sub = `${meta.emoji} ${meta.ru} · уровень ${step.level} · урок ${step.part + 1}`;
    if (step.newWords) {
      // Урок новых слов — просьба жителя места.
      npc = NPC_BY_LOCATION[step.loc];
      if (npc) {
        label = `Просьба: ${npc.name}`;
        sub = `Выучить ${step.newWords} ${newWordsLabel(step.newWords)} · ${meta.emoji} ${meta.ru}, урок ${step.part + 1}`;
      } else sub += ` · ${step.newWords} ${newWordsLabel(step.newWords)}`;
    }
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
      {npc && <NpcPortrait look={npc.look} size={54} className="-my-1" />}
      <div className="min-w-0 flex-1">
        <div className="font-pixel text-xs tracking-widest text-gold uppercase">{label}</div>
        <div className="font-pixel text-2xl font-bold">Продолжить</div>
        <div className="text-sm opacity-90">{sub}</div>
      </div>
      <div className="bob font-pixel text-3xl text-gold" aria-hidden>
        ▶
      </div>
    </Link>
  );
}

/** Строка «Путь» под «Продолжить»: глава, собранные обрывки и ближайший обрывок. Ведёт на карту странствий. */
function JourneyLine() {
  const fragments = useJourney((s) => s.fragments);
  const seals = useJourney((s) => s.seals);
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const buildings = useCity((s) => s.buildings);
  const journey = useMemo(() => currentJourney(), [fragments, seals, cards, grammar]);
  const ch = journey.chapters[journey.current - 1];
  const got = ch.places.filter((p) => p.got).length;
  const goal = nearestGoal(ch, (loc) => (buildings[loc as LocationId]?.level ?? 0) > 0);

  let next = '';
  if (goal?.kind === 'place') {
    const meta = LOCATION_BY_ID[goal.location as LocationId];
    const words = `${goal.wordsLeft} ${plural(goal.wordsLeft, ['слово', 'слова', 'слов'])}`;
    next = goal.open ? `${meta.emoji} ${meta.ru}: осталось ${words}` : `${meta.emoji} ${meta.ru}: откройте место, ${words}`;
  } else if (goal?.kind === 'seal') {
    const parts = [
      goal.lessonsLeft ? `${goal.lessonsLeft} ${plural(goal.lessonsLeft, ['урок', 'урока', 'уроков'])} ${ch.chapter.districts.join(' и ')}` : '',
      goal.scrollLeft ? `${goal.scrollLeft} ${plural(goal.scrollLeft, ['слово', 'слова', 'слов'])} свитка` : '',
    ].filter(Boolean);
    next = `Печать: осталось ${parts.join(' и ')}`;
  }

  return (
    <Link
      to="/journey-map"
      data-testid="journey-line"
      className="press mt-2 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-orange-50 px-4 py-2"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {journey.finished ? 'Все карты собраны' : `Глава ${ch.chapter.roman} · ${got} / ${ch.places.length} обрывков`}
        </div>
        {next && <div className="truncate text-xs text-stone-500">{next}</div>}
      </div>
      <span className="shrink-0 text-stone-500" aria-hidden>
        🗺️ →
      </span>
    </Link>
  );
}

export function Home() {
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const buildings = useCity((s) => s.buildings);
  const coins = useCity((s) => s.coins);
  const opened = useJourney((s) => s.opened);
  const rep = useErrands((s) => s.rep);
  // Счётчик пересчитывается и после полуночи, если приложение не закрывали.
  const now = useNow(60_000);
  const dueSplit = useMemo(() => splitCards(dueCards(Object.values(cards), now)), [cards, now]);
  const due = dueSplit.words.length + dueSplit.rules.length;
  const dueText = [
    dueSplit.words.length ? `${dueSplit.words.length} ${plural(dueSplit.words.length, ['слово', 'слова', 'слов'])}` : '',
    dueSplit.rules.length ? `${dueSplit.rules.length} ${plural(dueSplit.rules.length, ['правило', 'правила', 'правил'])}` : '',
  ].filter(Boolean).join(' и ');
  const learned = useMemo(() => wordIds(Object.keys(cards)).length, [cards]);

  const open = useMemo(
    () => LOCATIONS.filter((l) => (buildings[l.id]?.level ?? 0) > 0).map((l) => l.id),
    [buildings],
  );
  const words = useOpenWords(open);
  const day = useProgress((s) => s.day);
  const newPerDay = useSettings((s) => s.newPerDay);
  const dueCount = useMemo(() => dueCards(Object.values(cards), Date.now()).length, [cards]);
  const step = useMemo(() => {
    if (!words) return null;
    const levels = Object.fromEntries(open.map((id) => [id, buildings[id]!.level]));
    return nextStepWithLimit({
      locations: LOCATIONS, levels, words, cards, coins, recent: recentLocation(cards),
      isLevelOpen: (l) => isLevelOpen(l, opened),
      chapterOf: (l) => chapterOfLevel(l)?.id ?? 99,
      discount: (loc, cost) => discountedCost(cost, rep[NPC_BY_LOCATION[loc]?.id ?? ''] ?? 0),
      limit: { newToday: day.date === dayKey(Date.now()) ? day.newWords : 0, perDay: newPerDay, due: dueCount },
    });
  }, [words, open, buildings, cards, coins, opened, rep, day, newPerDay, dueCount]);

  const nextGrammar = useMemo(() => {
    for (const d of DISTRICTS) {
      if (!isDistrictOpen(d.id, opened)) break;
      const l = lessonsOf(d.id).find((x) => !grammar[x.id]);
      if (l) return { ...l, district: d.title };
    }
    return null;
  }, [grammar, opened]);

  return (
    <Screen>
      <StatsBar />
      <div className="px-3 pt-4">
        {/* Пока слова грузятся, держим место, чтобы экран не прыгал. */}
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            {step ? <ContinueCard step={step} /> : <div className="h-[104px] rounded-xl bg-stone-200" />}
          </div>
          <Link
            to="/journey-map"
            aria-label="Карта странствий"
            data-testid="map-button"
            className="press flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-wood bg-orange-50 shadow-md"
          >
            <span className="text-3xl" aria-hidden>
              🗺️
            </span>
            <span className="font-pixel text-sm">Карта</span>
          </Link>
        </div>
        <JourneyLine />
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
            <div className="text-sm text-stone-500">{due ? `${dueText} на сегодня` : 'На сегодня всё повторено'}</div>
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
