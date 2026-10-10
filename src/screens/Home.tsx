import { type ReactNode, useEffect, useMemo, useState } from 'react';
import dockReview from '../assets/dock/review.webp';
import dockJourney from '../assets/dock/journey.webp';
import dockGrammar from '../assets/dock/grammar.webp';
import dockBlitz from '../assets/dock/blitz.webp';
import dockFestival from '../assets/dock/festival.webp';
import dockPlacement from '../assets/dock/placement.webp';
import dockEmpty from '../assets/dock/empty.webp';
import bg1 from '../assets/home/bg-1.webp';
import bg2 from '../assets/home/bg-2.webp';
import bg3 from '../assets/home/bg-3.webp';
import bg4 from '../assets/home/bg-4.webp';
import bg5 from '../assets/home/bg-5.webp';
import bgVault from '../assets/home/bg-vault.webp';
import { useSphinx } from '../store/sphinx';
import { Link, Navigate } from 'react-router-dom';
import { cachedLocation, loadLocation } from '../content';
import { DISTRICTS, lessonsOf, loadLesson } from '../content/grammar';
import { LOCATION_BY_ID, LOCATIONS } from '../content/locations';
import type { LocationId, Npc, Word } from '../content/schema';
import { type NextStep, nextStepWithLimit, recentLocation, stepPlace } from '../domain/next';
import { chapterById, chapterOfLevel, isDistrictOpen, isLevelOpen, nearestGoal } from '../domain/chapters';
import { plural } from '../domain/medals';
import { discountedCost } from '../domain/reputation';
import { useRumors } from '../store/rumors';
import { RUMOR_MIN_WORDS, RUMOR_TITLE, rumorDue, rumorKind } from '../domain/rumor';
import { useErrands } from '../store/errands';
import { CHRONICLER, NPC_BY_LOCATION } from '../content/npcs';
import { NpcPortrait, portraitUrl } from '../components/NpcPortrait';
import { useSettings } from '../store/settings';
import { currentJourney, useJourney } from '../store/journey';
import { dayKey, dayNumber, dueCards } from '../domain/srs';
import { isVerbId, splitCards, wordIds } from '../domain/itemId';
import { useNow } from '../lib/useNow';
import { CityGrid } from '../components/CityGrid';
import { useFestivalInvite } from '../components/FestivalBits';
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
import { usePrologue } from '../store/prologue';
import { homeBlocks, prologuePending } from '../domain/prologue';
import { useChronicleDue } from './Chronicle';

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
  if ((step.kind !== 'errands' && step.kind !== 'review') || step.then.kind !== 'learn') return null;
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
  if (step.kind === 'review') {
    const cards = `${step.due} ${plural(step.due, ['карточка', 'карточки', 'карточек'])}`;
    return (
      <Link to="/review" data-testid="continue" data-kind="review" className="press quest-art relative flex items-center py-7 pr-[58px] pl-[86px]">
        <QuestWindow icon="⏳" />
        <div className="min-w-0">
          <div className="quest-label text-[12.5px] uppercase">Текущий квест</div>
          <div className="quest-title text-[19px] leading-tight font-semibold uppercase">Повторение</div>
          <QuestLines lines={[`К повтору ${cards}.`, 'Новые слова подождут']} />
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

/** «Путь»: глава, собранные обрывки и ближайший обрывок. Для кнопки «Путь» на главной. */
function useJourneyHint(): { got: number; total: number; text: string } {
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

  const head = journey.finished ? 'Все карты собраны' : `Глава ${ch.chapter.roman} • ${got} / ${ch.places.length} обрывков`;
  return { got, total: ch.places.length, text: next ? `${head}. ${next}` : head };
}

const DOCK_ART = {
  review: dockReview,
  journey: dockJourney,
  grammar: dockGrammar,
  blitz: dockBlitz,
  festival: dockFestival,
  placement: dockPlacement,
  empty: dockEmpty,
};

const HOME_BG: Record<string, string> = { '1': bg1, '2': bg2, '3': bg3, '4': bg4, '5': bg5, vault: bgVault };

/** Фон главной: земля открытой главы, после Эликсира — Хранилище. */
export function homeBackground(opened: number, sage: boolean): string {
  return sage ? 'vault' : String(Math.min(Math.max(opened, 1), 5));
}

/**
 * Круглая кнопка ряда над картой (задача 14.1): знак, короткая подпись, бейдж. Полный текст прежнего блока — в `text`:
 * его читает экранный диктор, а сквозные тесты проверяют по нему, что в блоке.
 */
function DockButton({ to, art, label, text, badge, testId, children }: { to: string; art: string; label: string; text: string; badge?: string | number; testId?: string; children?: ReactNode }) {
  return (
    // Кнопок бывает до семи: на узком экране они сжимаются, а не уходят за край.
    <Link to={to} className="press flex w-[62px] min-w-0 shrink flex-col items-center" data-testid={testId}>
      {/* Медальон — картинка из `docs/design/home-dock.png` (режет `scripts/build-dock-art.py`). */}
      <span className="relative block aspect-square w-full max-w-[56px] drop-shadow-[0_2px_0_#2b1b0e]" aria-hidden>
        <img src={art} alt="" width={56} height={56} className="block h-full w-full" />
        {/* Знак поверх пустого медальона (Летопись — портрет Летописца). */}
        {children && <span className="absolute inset-[20%] flex items-center justify-center overflow-hidden rounded-full">{children}</span>}
        {badge !== undefined && badge !== '' && (
          <span className="absolute -top-1.5 -right-2 min-w-[22px] rounded-full border-2 border-[#2b1b0e] bg-gold px-1 text-center text-[12px] leading-[18px] font-bold text-[#2b1b0e] tabular-nums">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-1 text-[13px] leading-none text-[#e8dcc0]" aria-hidden>
        {label}
      </span>
      <span className="sr-only">{text}</span>
    </Link>
  );
}

/** Первый запуск курса: предложить входной тест (задача 9.1) — кнопкой в ряду, с крестиком «Не предлагать». */
function PlacementButton() {
  return (
    <div className="relative flex w-[62px] min-w-0 shrink" data-testid="placement-offer">
      <DockButton
        to="/placement"
        art={DOCK_ART.placement}
        label="Расспросы"
        badge="?"
        testId="placement-go"
        text={`Уже знаете ${L.name.toLowerCase()}? Летописец расспросит, где вы бывали, и засчитает знакомые главы. Пройти входной тест.`}
      />
      <button
        type="button"
        onClick={() => usePlacement.getState().skip()}
        aria-label="Не предлагать входной тест"
        className="press absolute -top-1.5 -left-1 h-[22px] w-[22px] rounded-full border-2 border-[#2b1b0e] bg-[#cfc6b0] text-[12px] leading-none font-bold text-[#2b1b0e]"
        data-testid="placement-skip-home"
      >
        ×
      </button>
    </div>
  );
}

export function Home() {
  // Главная — в тёмном оформлении: фон вешается на body, пока экран открыт.
  useEffect(() => {
    document.body.classList.add('home-dark');
    return () => document.body.classList.remove('home-dark');
  }, []);
  // Фон — земля открытой главы, после Эликсира — Хранилище (картины из docs/design/home-backgrounds-prompt.md).
  const bgOpened = useJourney((s) => s.opened);
  const sage = useSphinx((s) => s.rec.elixir !== undefined);
  const bg = homeBackground(bgOpened, sage);
  useEffect(() => {
    document.body.style.setProperty('--home-bg', `url("${HOME_BG[bg]}")`);
    document.body.dataset.homeBg = bg;
    return () => {
      document.body.style.removeProperty('--home-bg');
      delete document.body.dataset.homeBg;
    };
  }, [bg]);
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
  const prologue = usePrologue((s) => s.rec);
  // Главная открывается по мере игры (задача 13.2): у новичка — только «Продолжить».
  const blocks = homeBlocks(learned, Object.keys(cards).length, Object.keys(grammar).length);

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

  // Предзагрузка (задача 14.6): слова места из «Продолжить» и следующий урок грамматики, пока игрок на главной.
  const preloadPlace = step ? stepPlace(step) : null;
  const preloadLesson = nextGrammar?.id ?? null;
  useEffect(() => {
    const t = setTimeout(() => {
      if (preloadPlace && !cachedLocation(preloadPlace)) void loadLocation(preloadPlace);
      if (preloadLesson) void loadLesson(preloadLesson);
    }, 400);
    return () => clearTimeout(t);
  }, [preloadPlace, preloadLesson]);

  const journeyHint = useJourneyHint();
  const festival = useFestivalInvite();
  const chronicle = useChronicleDue(now);
  // Событие дня (задача 13.7): кнопка в ряду, пока сегодня не пройдено.
  const rumorDay = useRumors((s) => s.rec.day);
  const rumorToday = learned >= RUMOR_MIN_WORDS && rumorDue({ day: rumorDay, got: [] }, dayNumber(Date.now()));
  const chronicleCount = chronicle ? chronicle.scenes.length + (chronicle.note ? 1 : 0) + chronicle.books : 0;

  // Первый запуск: сначала пролог у ворот города.
  if (prologuePending(prologue) && !Object.keys(cards).length) return <Navigate to="/prologue" replace />;

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
        {/* Всё остальное — ряд круглых кнопок (задача 14.1): карта города начинается на первом экране. */}
        <div className="mt-[8px] flex justify-center gap-[6px] px-[5px] pb-[2px]" data-testid="home-dock">
          {placementOffered(placement, learned) && <PlacementButton />}
          {festival && <DockButton to={festival.to} art={DOCK_ART.festival} label="Праздник" badge="!" text={festival.text} testId="festival-banner" />}
          {blocks.review && (
            <DockButton
              to="/review"
              art={DOCK_ART.review}
              label="Повтор"
              badge={due || undefined}
              text={`Повторить: ${due ? `${dueText} на сегодня` : 'На сегодня всё повторено'}`}
              testId="review-card"
            />
          )}
          {blocks.journey && chronicleCount > 0 && (
            <DockButton
              to="/chronicle"
              art={DOCK_ART.empty}
              label="Летопись"
              badge={chronicleCount}
              testId="chronicle-button"
              text={`Летопись: ${[chronicle!.scenes.length ? `новых записей ${chronicle!.scenes.length}` : '', chronicle!.note ? 'Летописец оставил записку' : '', chronicle!.books ? `новых книг ${chronicle!.books}` : ''].filter(Boolean).join(', ')}`}
            >
              <NpcPortrait look={CHRONICLER.look} size={34} />
            </DockButton>
          )}
          {blocks.journey && rumorToday && (
            <DockButton to="/rumor" art={DOCK_ART.empty} label="Слухи" badge="!" testId="rumor-button" text={`Слухи города: ${RUMOR_TITLE[rumorKind(dayNumber(Date.now()))].toLowerCase()}`}>
              <span className="text-[22px] leading-none">👂</span>
            </DockButton>
          )}
          {blocks.journey && <DockButton to="/journey-map" art={DOCK_ART.journey} label="Путь" badge={journeyHint.got || undefined} text={journeyHint.text} testId="journey-line" />}
          {blocks.grammar && nextGrammar && (
            <DockButton to={`/grammar/${nextGrammar.id}`} art={DOCK_ART.grammar} label="Правила" text={`Урок ${nextGrammar.district}: ${nextGrammar.title}`} testId="grammar-next" />
          )}
          {blocks.blitz && <DockButton to="/blitz" art={DOCK_ART.blitz} label="Блиц" text={`Блиц: 60 секунд · ${learned} слов в запасе`} testId="blitz-button" />}
        </div>
      </div>

      <CityGrid />
    </Screen>
  );
}
