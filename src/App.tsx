import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useJourney } from './store/journey';
import { useSphinx } from './store/sphinx';
import { useSettings } from './store/settings';
import { playTheme, stopMusic } from './audio/music';
import { themeFor } from './domain/chiptune';
import { bootstrap } from './store/bootstrap';
import { Home } from './screens/Home';
import { LearnScreen } from './screens/Learn';
import { PhraseLessonScreen } from './screens/PhraseLesson';
import { useMotivation } from './store/motivation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CourseBanner, UpdateBanner } from './components/UpdateBanner';
import { NavBar } from './components/NavBar';
import { LevelUpToast } from './components/HeroLevel';
import { MedalAward } from './components/MedalAward';
import { useErrands } from './store/errands';
import { ChapterScene } from './components/ChapterScene';
import { Loading } from './components/ui';

/**
 * Экран своим чанком (задача 16.2): сразу грузятся только главная и уроки, остальное — при первом переходе, пока
 * на экране свиток ожидания. Офлайн не страдает: все чанки в precache.
 */
function screen<P extends object>(load: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType<P> }));
}
const LocationScreen = screen(() => import('./screens/Location'), 'LocationScreen');
const SceneScreen = screen(() => import('./screens/Scene'), 'SceneScreen');
const MissionScreen = screen(() => import('./screens/Mission'), 'MissionScreen');
const TrialScreen = screen(() => import('./screens/Trial'), 'TrialScreen');
const GuardianScreen = screen(() => import('./screens/Guardian'), 'GuardianScreen');
const SphinxScreen = screen(() => import('./screens/Sphinx'), 'SphinxScreen');
const VaultScreen = screen(() => import('./screens/Vault'), 'VaultScreen');
const PlacementScreen = screen(() => import('./screens/Placement'), 'PlacementScreen');
const ReviewScreen = screen(() => import('./screens/Review'), 'ReviewScreen');
const BlitzScreen = screen(() => import('./screens/Blitz'), 'BlitzScreen');
const ForgeScreen = screen(() => import('./screens/Forge'), 'ForgeScreen');
const BellsScreen = screen(() => import('./screens/Bells'), 'BellsScreen');
const FestivalScreen = screen(() => import('./screens/Festival'), 'FestivalScreen');
const SettingsScreen = screen(() => import('./screens/Settings'), 'SettingsScreen');
const GrammarMap = screen(() => import('./screens/GrammarMap'), 'GrammarMap');
const GrammarLessonScreen = screen(() => import('./screens/GrammarLesson'), 'GrammarLessonScreen');
const ProfileScreen = screen(() => import('./screens/Profile'), 'ProfileScreen');
const MyPathScreen = screen(() => import('./screens/MyPath'), 'MyPathScreen');
const WordsScreen = screen(() => import('./screens/Words'), 'WordsScreen');
const MedalsScreen = screen(() => import('./screens/Medals'), 'MedalsScreen');
const JourneyMapScreen = screen(() => import('./screens/JourneyMap'), 'JourneyMapScreen');
const PrologueScreen = screen(() => import('./screens/Prologue'), 'PrologueScreen');
const ErrandScreen = screen(() => import('./screens/Errands'), 'ErrandScreen');
const ErrandsScreen = screen(() => import('./screens/Errands'), 'ErrandsScreen');
const MistakesScreen = screen(() => import('./screens/Errands'), 'MistakesScreen');
const ChronicleScreen = screen(() => import('./screens/Chronicle'), 'ChronicleScreen');
const BookScreen = screen(() => import('./screens/Books'), 'BookScreen');
const LetterScreen = screen(() => import('./screens/Letter'), 'LetterScreen');
const LettersDiaryScreen = screen(() => import('./screens/Letter'), 'LettersDiaryScreen');
const NoteScreen = screen(() => import('./screens/Letter'), 'NoteScreen');
const ShopScreen = screen(() => import('./screens/Shop'), 'ShopScreen');
const RumorScreen = screen(() => import('./screens/Rumor'), 'RumorScreen');
const DiaryScreen = screen(() => import('./screens/Diary'), 'DiaryScreen');

/** Новый экран открывается сверху, а не с прокруткой предыдущего. */
function ScrollToTop() {
  const { pathname } = useLocation();
  // Фигурные скобки обязательны: в новом Chrome scrollTo возвращает Promise,
  // и React пытался бы вызвать его как функцию очистки при смене экрана.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Музыка по месту (задача 13.3): город, на карте странствий и у стражей — земля открытой главы. */
function SoundDirector() {
  const path = useLocation().pathname;
  const opened = useJourney((s) => s.opened);
  const sage = useSphinx((s) => s.rec.elixir !== undefined);
  const on = useSettings((s) => s.musicVolume > 0);
  useEffect(() => {
    if (on) playTheme(themeFor(path, opened, sage));
    else stopMusic();
  }, [path, opened, sage, on]);
  return null;
}

function TabLayout() {
  return (
    <>
      <div className="pb-[calc(var(--nav-space)+1rem)]">
        <Suspense fallback={<Loading inline />}>
          <Outlet />
        </Suspense>
      </div>
      <UpdateBanner />
      <CourseBanner />
      <NavBar />
      {/* Сцена новой главы — на экранах с меню, после итогов урока, а не поверх него. */}
      <ChapterScene />
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
    // Новый день мог начаться, пока приложение было в фоне.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      useMotivation.getState().settle();
      useErrands.getState().refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (error) return <div className="p-6 text-bad">Не удалось открыть хранилище: {error}</div>;
  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-4xl">☕</div>;

  return (
    <ErrorBoundary>
    <HashRouter>
      <ScrollToTop />
      <SoundDirector />
      <LevelUpToast />
      <MedalAward />
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/loc/:id" element={<LocationScreen />} />
          <Route path="/grammar" element={<GrammarMap />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/path" element={<MyPathScreen />} />
          <Route path="/medals" element={<MedalsScreen />} />
          <Route path="/journey-map" element={<JourneyMapScreen />} />
          <Route path="/errands" element={<ErrandsScreen />} />
        </Route>
        <Route path="/grammar/:id" element={<GrammarLessonScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/errand/:id" element={<ErrandScreen />} />
        <Route path="/mistakes" element={<MistakesScreen />} />
        <Route path="/chronicle" element={<ChronicleScreen />} />
        <Route path="/book/:id" element={<BookScreen />} />
        <Route path="/prologue" element={<PrologueScreen />} />
        <Route path="/letter/:id" element={<LetterScreen />} />
        <Route path="/note/:id" element={<NoteScreen />} />
        <Route path="/letters" element={<LettersDiaryScreen />} />
        <Route path="/shop" element={<ShopScreen />} />
        <Route path="/rumor" element={<RumorScreen />} />
        <Route path="/diary" element={<DiaryScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/:section" element={<SettingsScreen />} />
        <Route path="/learn/:id/:level/:part" element={<LearnScreen />} />
        <Route path="/practice/:id/:level" element={<LearnScreen practice />} />
        <Route path="/phrases/:id/:level" element={<PhraseLessonScreen />} />
        <Route path="/scene/:id" element={<SceneScreen />} />
        <Route path="/mission/:id" element={<MissionScreen />} />
        <Route path="/trial/:id" element={<TrialScreen />} />
        <Route path="/guardian/:chapter" element={<GuardianScreen />} />
        <Route path="/sphinx" element={<SphinxScreen />} />
        <Route path="/vault" element={<VaultScreen />} />
        <Route path="/placement" element={<PlacementScreen />} />
        <Route path="/blitz" element={<BlitzScreen />} />
        <Route path="/forge" element={<ForgeScreen />} />
        <Route path="/bells" element={<BellsScreen />} />
        <Route path="/festival/:id" element={<FestivalScreen />} />
        <Route path="/words" element={<WordsScreen />} />
      </Routes>
      </Suspense>
    </HashRouter>
    </ErrorBoundary>
  );
}
