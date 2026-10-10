import { useEffect, useState } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useJourney } from './store/journey';
import { useSphinx } from './store/sphinx';
import { useSettings } from './store/settings';
import { playTheme, stopMusic } from './audio/music';
import { themeFor } from './domain/chiptune';
import { bootstrap } from './store/bootstrap';
import { Home } from './screens/Home';
import { LocationScreen } from './screens/Location';
import { LearnScreen } from './screens/Learn';
import { PhraseLessonScreen } from './screens/PhraseLesson';
import { SceneScreen } from './screens/Scene';
import { MissionScreen } from './screens/Mission';
import { TrialScreen } from './screens/Trial';
import { GuardianScreen } from './screens/Guardian';
import { SphinxScreen } from './screens/Sphinx';
import { VaultScreen } from './screens/Vault';
import { PlacementScreen } from './screens/Placement';
import { ReviewScreen } from './screens/Review';
import { BlitzScreen } from './screens/Blitz';
import { ForgeScreen } from './screens/Forge';
import { BellsScreen } from './screens/Bells';
import { FestivalScreen } from './screens/Festival';
import { SettingsScreen } from './screens/Settings';
import { GrammarMap } from './screens/GrammarMap';
import { GrammarLessonScreen } from './screens/GrammarLesson';
import { ProfileScreen } from './screens/Profile';
import { WordsScreen } from './screens/Words';
import { useMotivation } from './store/motivation';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBanner } from './components/UpdateBanner';
import { NavBar } from './components/NavBar';
import { LevelUpToast } from './components/HeroLevel';
import { MedalAward } from './components/MedalAward';
import { useErrands } from './store/errands';
import { ChapterScene } from './components/ChapterScene';
import { MedalsScreen } from './screens/Medals';
import { JourneyMapScreen } from './screens/JourneyMap';
import { PrologueScreen } from './screens/Prologue';
import { ErrandScreen, ErrandsScreen, MistakesScreen } from './screens/Errands';
import { ChronicleScreen } from './screens/Chronicle';
import { BookScreen } from './screens/Books';
import { LetterScreen, LettersDiaryScreen, NoteScreen } from './screens/Letter';
import { ShopScreen } from './screens/Shop';
import { RumorScreen } from './screens/Rumor';

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
      <div className="pb-44">
        <Outlet />
      </div>
      <UpdateBanner />
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
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/loc/:id" element={<LocationScreen />} />
          <Route path="/grammar" element={<GrammarMap />} />
          <Route path="/profile" element={<ProfileScreen />} />
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
        <Route path="/settings" element={<SettingsScreen />} />
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
    </HashRouter>
    </ErrorBoundary>
  );
}
