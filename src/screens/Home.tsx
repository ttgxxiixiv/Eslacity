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
import { NpcPortrait, portraitUrl } from '../components/NpcPortrait';
import { useSettings } from '../store/settings';
import { currentJourney, useJourney } from '../store/journey';
import { dayKey, dueCards } from '../domain/srs';
import { isVerbId, splitCards, wordIds } from '../domain/itemId';
import { useNow } from '../lib/useNow';
import { CityGrid } from '../components/CityGrid';
import { FestivalBanner } from '../components/FestivalBits';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMissions } from '../store/missions';
import { useTrials } from '../store/trials';
import { StatsBar } from '../components/Stats';
import { Screen } from '../components/ui';
import mapScroll from '../assets/home/map-scroll.webp';
import { L } from '../lang';
import { placementOffered } from '../domain/placement';
import { usePlacement } from '../store/placement';

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

/**
 * Окно портрета, нарисованное на свитке квеста: житель или значок, если квест не от жителя. Свиток тянется
 * по высоте карточки (`border-image`), поэтому окно задано долями её высоты: в картинке `quest.webp` высотой 228
 * окно занимает строки 59–180. Рисованный портрет заполняет окно целиком, без полосы снизу.
 */
function QuestWindow({ npc, icon }: { npc?: Npc; icon: string }) {
  const art = npc ? portraitUrl(npc.look) : undefined;
  return (
    <div className="absolute top-[25.9%] left-[27px] flex h-[53.1%] w-[49px] items-end justify-center overflow-hidden" aria-hidden data-testid="quest-window">
      {art ? (
        <img src={art} alt="" className="h-full w-full object-cover object-top" data-testid="npc-art" />
      ) : npc ? (
        <NpcPortrait look={npc.look} size={60} />
      ) : (
        <span className="mb-[18px] text-[30px] leading-none">{icon}</span>
      )}
    </div>
  );
}

/** Белая подпись квеста: строки по смыслу, длинная строка переносится по словам. */
function QuestLines({ lines }: { lines: string[] }) {
  return (
    <div className="quest-text text-[14.5px] leading-[1.3]">
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
      <Link to="/errands" data-testid="continue" data-kind="errands" className="press quest-art relative flex items-center py-7 pr-[58px] pl-[86px]">
        <QuestWindow icon="📜" />
        <div className="min-w-0">
          <div className="quest-label text-[12.5px] uppercase">Текущий квест</div>
          <div className="quest-title text-[19px] leading-tight font-semibold uppercase">Поручения</div>
          <QuestLines lines={sub} />
        </div>
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
    <Link to={to} data-testid="continue" className="press quest-art relative flex items-center py-7 pr-[58px] pl-[86px]">
      <QuestWindow npc={npc} icon={meta.emoji} />
      <div className="min-w-0 flex-1">
        <div className="quest-label truncate text-[12.5px] uppercase">{label}</div>
        <div className="quest-title text-[19px] leading-tight font-semibold uppercase">Продолжить</div>
        <QuestLines lines={sub} />
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
    <Link to="/journey-map" data-testid="journey-line" className="press banner-journey banner-shadow mt-[7px] flex items-center pr-[70px] pl-[18px]">
      <div className="min-w-0">
        <div className="text-[16px] leading-tight text-[#2e2014]">
          {journey.finished ? 'Все карты собраны' : `Глава ${ch.chapter.roman} • ${got} / ${ch.places.length} обрывков`}
        </div>
        {next && <div className="truncate text-[14px] leading-tight text-[#4a3522]">{next}</div>}
      </div>
    </Link>
  );
}

/** Первый запуск курса: предложить входной тест (задача 9.1). Можно пропустить, тест остаётся в настройках. */
function PlacementOffer() {
  return (
    <div className="banner-shadow mt-[7px] rounded-2xl border-2 border-[#8a6a3a] bg-[#f4e6c6] px-4 py-3 text-[#2b1b0e]" data-testid="placement-offer">
      <div className="text-[18px] leading-tight font-semibold">Уже знаете {L.name.toLowerCase()}?</div>
      <div className="mt-0.5 text-[14.5px] leading-snug text-[#4a3522]">
        Летописец расспросит, где вы бывали, и засчитает знакомые главы. Это 10–15 минут.
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Link to="/placement" className="press flex-1 rounded-xl bg-[#2b4f8f] py-2 text-center text-[16px] font-semibold text-white" data-testid="placement-go">
          Пройти входной тест
        </Link>
        <button type="button" onClick={() => usePlacement.getState().skip()} className="press px-2 py-2 text-[15px] underline" data-testid="placement-skip-home">
          Пропустить
        </button>
      </div>
    </div>
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
  const placement = usePlacement((s) => s.rec);

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
      <div className="home-font px-[4px] pt-[7px]">
        {/* Пока слова грузятся, держим место, чтобы экран не прыгал. */}
        <div className="flex gap-[2px]">
          <div className="min-w-0 flex-1">
            {step ? <ContinueCard step={step} /> : <div className="quest-art" />}
          </div>
          <Link
            to="/journey-map"
            aria-label="Карта странствий"
            data-testid="map-button"
            className="press relative w-[75px] shrink-0 self-stretch"
          >
            {/* Свиток с картой и надписью «Карта» — картинка из макета, для экранного диктора — aria-label. */}
            <img src={mapScroll} alt="" width={131} height={214} className="absolute top-[7px] left-0 block h-[calc(100%-7px)] w-full" />
          </Link>
        </div>
        {step && <LearnAnyway step={step} />}
        <div className="px-[5px]">
          {placementOffered(placement, learned) && <PlacementOffer />}
          {/* Неделя праздника (задача 10.5): приглашение хозяина. */}
          <FestivalBanner />
          <JourneyLine />
          {nextGrammar && (
            <Link to={`/grammar/${nextGrammar.id}`} className="press banner-grammar banner-shadow mt-[7px] flex items-center justify-between gap-3 pr-[26px] pl-[48px]">
              <span className="truncate text-[19px] font-semibold text-[#2b1b0e]">{nextGrammar.title}</span>
              <span className="shrink-0 text-[15px] text-[#3a2616]">{nextGrammar.district}</span>
            </Link>
          )}
          <Link to="/review" className="press banner-review banner-shadow relative mt-[6px] flex items-center pr-[88px] pl-[18px]" data-testid="review-card">
            <div className="min-w-0">
              <div className="text-[19px] leading-tight font-semibold text-[#2b1b0e] uppercase">Повторить</div>
              <div className="mt-0.5 text-[15px] leading-tight text-[#3f2c1b]">{due ? `${dueText} на сегодня` : 'На сегодня всё повторено'}</div>
            </div>
            {/* Число стоит в круге на рунном щите справа. */}
            <span
              className={`absolute top-[38px] right-[38px] translate-x-1/2 -translate-y-1/2 font-serif font-bold text-[#2b1a0e] tabular-nums ${due ? '' : 'opacity-60'}`}
              style={{ fontSize: due >= 1000 ? 17 : due >= 100 ? 26 : 37 }}
            >
              {due}
            </span>
          </Link>
          <Link to="/blitz" className="press banner-blitz banner-shadow mt-[7px] flex items-center justify-between gap-3 pr-[17px] pl-[48px]">
            <span className="text-[19px] font-semibold text-[#2b1b0e] uppercase">Блиц</span>
            <span className="min-w-0 text-right text-[15px] leading-tight text-[#3a2616]">60 секунд · {learned} слов в запасе</span>
          </Link>
        </div>
      </div>

      <CityGrid />
    </Screen>
  );
}
