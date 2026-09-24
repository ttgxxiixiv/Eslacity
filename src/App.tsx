import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { bootstrap } from './store/bootstrap';
import { Home } from './screens/Home';
import { LocationScreen } from './screens/Location';
import { LearnScreen } from './screens/Learn';
import { ReviewScreen } from './screens/Review';
import { BlitzScreen } from './screens/Blitz';
import { SettingsScreen } from './screens/Settings';

function TabLayout() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `press flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? 'text-brand' : 'text-stone-500'}`;
  return (
    <>
      <div className="pb-20">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md">
          <NavLink to="/" end className={tab}>
            <span className="text-xl">🏙️</span>Город
          </NavLink>
          <NavLink to="/review" className={tab}>
            <span className="text-xl">🔁</span>Повтор
          </NavLink>
          <NavLink to="/settings" className={tab}>
            <span className="text-xl">⚙️</span>Настройки
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
  }, []);

  if (error) return <div className="p-6 text-bad">Не удалось открыть хранилище: {error}</div>;
  if (!ready) return <div className="flex min-h-dvh items-center justify-center text-4xl">☕</div>;

  return (
    <HashRouter>
      <Routes>
        <Route element={<TabLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/loc/:id" element={<LocationScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="/review" element={<ReviewScreen />} />
        <Route path="/learn/:id/:level/:part" element={<LearnScreen />} />
        <Route path="/practice/:id/:level" element={<LearnScreen practice />} />
        <Route path="/blitz" element={<BlitzScreen />} />
      </Routes>
    </HashRouter>
  );
}
