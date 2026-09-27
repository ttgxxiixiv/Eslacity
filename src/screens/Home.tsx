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
import { isVerbId, splitCards, wordIds } from '../domain/itemId';
import { useNow } from '../lib/useNow';
import { CityGrid } from '../components/CityGrid';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMissions } from '../store/missions';
import { useTrials } from '../store/trials';
import { StatsBar } from '../components/Stats';
import { Screen } from '../components/ui';
import { RuneBadge } from '../components/Runes';
import mapPicture from '../assets/home/map-button-map.webp';

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

/** Золотая стрелка квеста: объёмный наконечник с вырезом, светлая грань сверху, тёмная снизу. Покачивается. */
function QuestArrow() {
  return (
    <svg viewBox="0 0 40 36" className="bob h-7 w-8 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="qa-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4c2" />
          <stop offset="1" stopColor="#e9bb4f" />
        </linearGradient>
        <linearGradient id="qa-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8912c" />
          <stop offset="1" stopColor="#7a5410" />
        </linearGradient>
      </defs>
      <path d="M4 4 L37 19 L4 34 L12 19 Z" fill="#1a120a" opacity="0.55" transform="translate(1.5 2)" />
      <path d="M3 2 L36 17 L12 17 Z" fill="url(#qa-top)" />
      <path d="M12 17 L36 17 L3 32 Z" fill="url(#qa-bottom)" />
      <path d="M3 2 L36 17 L3 32 L12 17 Z" fill="none" stroke="#5c3d08" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** Свиток пергамента для плашки урока грамматики. */
function ScrollIcon() {
  return (
    <svg viewBox="0 0 32 28" className="h-7 w-8 shrink-0" aria-hidden>
      <path d="M6 5h20v16H6z" fill="#e8d09a" stroke="#4a2d16" strokeWidth="1.5" />
      <path d="M10 10h12M10 13.5h12M10 17h8" stroke="#8a5a2c" strokeWidth="1.3" />
      <rect x="2" y="2.5" width="6" height="21" rx="3" fill="#c9a468" stroke="#4a2d16" strokeWidth="1.5" />
      <rect x="24" y="4.5" width="6" height="21" rx="3" fill="#c9a468" stroke="#4a2d16" strokeWidth="1.5" />
      <path d="M4 6v14M26 8v14" stroke="#f3e1b3" strokeWidth="1" opacity="0.8" />
    </svg>
  );
}

/** Молния блица в синем магическом сиянии. */
function BoltIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <defs>
        <radialGradient id="bolt-glow">
          <stop offset="0" stopColor="#8fb0ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#3a52c4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bolt-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="1" stopColor="#f1b82c" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#bolt-glow)" />
      <path d="M23 3L9 22h9l-3 15 16-21h-9l4-13z" fill="url(#bolt-fill)" stroke="#5c3d08" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** Белая подпись квеста: строки по смыслу, длинная строка переносится по словам. */
function QuestLines({ lines }: { lines: string[] }) {
  return (
    <div className="quest-text text-[13px] leading-snug">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

/** Под карточкой поручений: учить новые слова, не дожидаясь повторения. Вне ряда с кнопкой карты, чтобы она равнялась карточке. */
function LearnAnyway({ step }: { step: NextStep }) {
  if (step.kind !== 'errands' || step.then.kind !== 'learn') return null;
  const then = step.then;
  return (
    <Link
      to={`/learn/${then.loc}/${then.level}/${then.part}`}
      className="mt-1.5 block text-center text-[#f1e2c0] underline underline-offset-2"
      data-testid="learn-anyway"
    >
      Всё равно учить новые слова
    </Link>
  );
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
    const words = `${step.due} ${plural(step.due, ['слово', 'слова', 'слов'])}`;
    const sub =
      step.reason === 'limit'
        ? ['Новых слов на сегодня хватит.', `Жители просят помочь вспомнить: ${words}`]
        : [`Накопилось ${words} к повтору.`, 'Сначала помогите жителям'];
    return (
      <Link
        to="/errands"
        data-testid="continue"
        data-kind="errands"
        className="press quest-scroll flex min-h-[124px] items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <div className="quest-label text-[11px] font-bold tracking-wider uppercase">Текущий квест</div>
          <div className="quest-title text-[19px] leading-tight font-extrabold uppercase">Поручения</div>
          <QuestLines lines={sub} />
        </div>
        <QuestArrow />
      </Link>
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
  // Подпись по строкам: каждая мысль с новой строки, без разделителей, которые рвут строку посередине.
  let sub: string[];
  let npc: Npc | undefined;
  let label = 'Текущий квест';
  if (step.kind === 'learn') {
    to = `/learn/${step.loc}/${step.level}/${step.part}`;
    sub = [`${meta.emoji} ${meta.ru}`, `уровень ${step.level}, урок ${step.part + 1}`];
    if (step.newWords) {
      // Урок новых слов — просьба жителя места.
      npc = NPC_BY_LOCATION[step.loc];
      if (npc) {
        label = `Просьба: ${npc.name}`;
        sub = [`Выучить ${step.newWords} ${newWordsLabel(step.newWords)}`, `${meta.emoji} ${meta.ru}, урок ${step.part + 1}`];
      } else sub.push(`${step.newWords} ${newWordsLabel(step.newWords)}`);
    }
  } else {
    to = `/loc/${step.loc}`;
    const what = step.kind === 'upgrade' ? `улучшить до уровня ${step.toLevel}` : 'открыть';
    sub = [`${meta.emoji} ${meta.ru}: ${what} за 🪙 ${step.cost}`];
    if (step.missing) sub.push(`Не хватает ${step.missing}`);
  }
  return (
    <Link
      to={to}
      data-testid="continue"
      className="press quest-scroll flex min-h-[124px] items-center justify-between gap-1.5"
    >
      {npc && (
        <div className="portrait-frame shrink-0">
          <div>
            <NpcPortrait look={npc.look} size={50} />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="quest-label truncate text-[11px] font-bold tracking-wider uppercase">{label}</div>
        <div className="quest-title text-[clamp(15px,4.6vw,19px)] leading-tight font-extrabold whitespace-nowrap uppercase">Продолжить</div>
        <QuestLines lines={sub} />
      </div>
      <QuestArrow />
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
  const missions = useMissions((s) => s.records);
  const trials = useTrials((s) => s.records);
  const journey = useMemo(() => currentJourney(), [fragments, seals, cards, grammar, missions, trials]);
  const ch = journey.chapters[journey.current - 1];
  const got = ch.places.filter((p) => p.got).length;
  const goal = nearestGoal(ch, (loc) => (buildings[loc as LocationId]?.level ?? 0) > 0);

  let next = '';
  if (goal?.kind === 'place') {
    const meta = LOCATION_BY_ID[goal.location as LocationId];
    const words = `${goal.wordsLeft} ${plural(goal.wordsLeft, ['слово', 'слова', 'слов'])}`;
    next = !goal.open
      ? `${meta.emoji} ${meta.ru}: откройте место, ${words}`
      : goal.wordsLeft || (!goal.mission && !goal.trial)
        ? `${meta.emoji} ${meta.ru}: осталось ${words}`
        : `${meta.emoji} ${meta.ru}: ${[goal.mission ? 'сюжетная миссия жителя' : '', goal.trial ? 'испытание места' : ''].filter(Boolean).join(' и ')}`;
  } else if (goal?.kind === 'seal') {
    const parts = [
      // Со стражем уроки района не условие печати: страж проверяет их сам.
      !goal.guardian && goal.lessonsLeft ? `${goal.lessonsLeft} ${plural(goal.lessonsLeft, ['урок', 'урока', 'уроков'])} ${ch.chapter.districts.join(' и ')}` : '',
      goal.scrollLeft ? `${goal.scrollLeft} ${plural(goal.scrollLeft, ['слово', 'слова', 'слов'])} свитка` : '',
    ].filter(Boolean);
    next = goal.guardian
      ? parts.length ? `Печать: осталось ${parts.join(' и ')}, потом страж` : 'Печать: победите стража'
      : `Печать: осталось ${parts.join(' и ')}`;
  }

  return (
    <Link
      to="/journey-map"
      data-testid="journey-line"
      className="press parchment mt-3 flex items-center justify-between gap-3 px-5 py-2.5"
    >
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-stone-900">
          {journey.finished ? 'Все карты собраны' : `Глава ${ch.chapter.roman} · ${got} / ${ch.places.length} обрывков`}
        </div>
        {next && <div className="truncate text-[13px] text-stone-600">{next}</div>}
      </div>
      <span className="flex shrink-0 items-center gap-2 text-lg text-stone-700" aria-hidden>
        🗺️ <span>→</span>
      </span>
    </Link>
  );
}

export function Home() {
  // Главная — в тёмном оформлении: фон вешается на body, пока экран открыт.
  useEffect(() => {
    document.body.classList.add('home-dark');
    return () => document.body.classList.remove('home-dark');
  }, []);
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const buildings = useCity((s) => s.buildings);
  const coins = useCity((s) => s.coins);
  const opened = useJourney((s) => s.opened);
  const rep = useErrands((s) => s.rep);
  // Счётчик пересчитывается и после полуночи, если приложение не закрывали.
  const now = useNow(60_000);
  const dueSplit = useMemo(() => splitCards(dueCards(Object.values(cards), now)), [cards, now]);
  const due = dueSplit.words.length + dueSplit.rules.length + dueSplit.phrases.length;
  const dueText = [
    dueSplit.words.length ? `${dueSplit.words.length} ${plural(dueSplit.words.length, ['слово', 'слова', 'слов'])}` : '',
    dueSplit.phrases.length ? `${dueSplit.phrases.length} ${plural(dueSplit.phrases.length, ['фраза', 'фразы', 'фраз'])}` : '',
    dueSplit.rules.length ? `${dueSplit.rules.length} ${plural(dueSplit.rules.length, ['правило', 'правила', 'правил'])}` : '',
  ].filter(Boolean).reduce((acc, part, i, all) => (i === 0 ? part : `${acc}${i === all.length - 1 ? ' и ' : ', '}${part}`), '');
  const learned = useMemo(() => wordIds(Object.keys(cards)).length, [cards]);

  const open = useMemo(
    () => LOCATIONS.filter((l) => (buildings[l.id]?.level ?? 0) > 0).map((l) => l.id),
    [buildings],
  );
  const words = useOpenWords(open);
  const day = useProgress((s) => s.day);
  const newPerDay = useSettings((s) => s.newPerDay);
  const dueCount = useMemo(() => dueCards(Object.values(cards), Date.now()).filter((c) => !isVerbId(c.wordId)).length, [cards]);
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
            {step ? <ContinueCard step={step} /> : <div className="h-[124px] rounded-xl bg-stone-200" />}
          </div>
          <Link
            to="/journey-map"
            aria-label="Карта странствий"
            data-testid="map-button"
            className="press map-scroll flex w-[66px] shrink-0 items-center justify-center self-stretch"
          >
            <span className="wax-seal" aria-hidden />
            <img src={mapPicture} alt="" width={231} height={236} className="block h-auto max-h-full w-[50px] drop-shadow-md" />
            {/* Для экранного диктора — aria-label ссылки. */}
            <span className="map-label flex items-center justify-center text-[11px] font-extrabold tracking-wider uppercase" aria-hidden>
              Карта
            </span>
          </Link>
        </div>
        {step && <LearnAnyway step={step} />}
        <JourneyLine />
        {nextGrammar && (
          <Link
            to={`/grammar/${nextGrammar.id}`}
            className="press parchment mt-3 flex items-center justify-between gap-3 py-3 pr-5 pl-4"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <ScrollIcon />
              <span className="truncate text-[17px] font-bold text-stone-900">{nextGrammar.title}</span>
            </span>
            <span className="shrink-0 font-bold text-stone-700">{nextGrammar.district}</span>
          </Link>
        )}
        <Link
          to="/review"
          className="press parchment mt-3 flex items-center justify-between gap-3 py-1.5 pr-3 pl-5"
          data-testid="review-card"
        >
          <div className="min-w-0">
            <div className="parchment-title text-[21px]">Повторить</div>
            <div className="text-[14px] text-stone-600">{due ? `${dueText} на сегодня` : 'На сегодня всё повторено'}</div>
          </div>
          <RuneBadge value={due} dim={!due} />
        </Link>
        <Link
          to="/blitz"
          className="press parchment mt-3 flex items-center justify-between gap-3 py-2.5 pr-5 pl-3"
        >
          <span className="flex items-center gap-2">
            <BoltIcon />
            <span className="parchment-title text-[21px]">Блиц</span>
          </span>
          <span className="min-w-0 text-right text-[13px] text-stone-700">60 секунд · {learned} слов в запасе</span>
        </Link>
      </div>

      <CityGrid />
    </Screen>
  );
}
