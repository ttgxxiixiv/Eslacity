import { useEffect, useState } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { bootstrap } from './store/bootstrap';
import { Home } from './screens/Home';
import { LocationScreen } from './screens/Location';
import { LearnScreen } from './screens/Learn';
import { ReviewScreen } from './screens/Review';
import { BlitzScreen } from './screens/Blitz';
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
import { ChapterScene } from './components/ChapterScene';
import { MedalsScreen } from './screens/Medals';
import { JourneyMapScreen } from './screens/JourneyMap';

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
    const onVisible = () => document.visibilityState === 'visible' && useMotivation.getState().settle();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  if (error) return <div className="p-6 text-bad">Не удалось открыть хранилище: {error}</div>;
  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-4xl">☕</div>;

  return (
    <ErrorBoundary>
    <HashRouter>
      <ScrollToTop />
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
        </Route>
        <Route path="/grammar/:id" element={<GrammarLessonScreen />} />
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/learn/:id/:level/:part" element={<LearnScreen />} />
        <Route path="/practice/:id/:level" element={<LearnScreen practice />} />
        <Route path="/blitz" element={<BlitzScreen />} />
        <Route path="/words" element={<WordsScreen />} />
      </Routes>
    </HashRouter>
    </ErrorBoundary>
  );
}
