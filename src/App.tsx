import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
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
  const tab = ({ isActive }: { isActive: boolean }) =>
    `press flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? 'text-brand' : 'text-stone-500'}`;
  return (
    <>
      <div className="pb-20">
        <Outlet />
      </div>
      <UpdateBanner />
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          <NavLink to="/" end className={tab}>
            <span className="text-xl">🏙️</span>Город
          </NavLink>
          <NavLink to="/grammar" className={tab}>
            <span className="text-xl">📘</span>Грамматика
          </NavLink>
          <NavLink to="/review" className={tab}>
            <span className="text-xl">🔁</span>Повтор
          </NavLink>
          <NavLink to="/profile" className={tab}>
            <span className="text-xl">👤</span>Профиль
          </NavLink>
        </div>
      </nav>
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
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/loc/:id" element={<LocationScreen />} />
          <Route path="/grammar" element={<GrammarMap />} />
          <Route path="/profile" element={<ProfileScreen />} />
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
